'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Shield, CheckCircle, ExternalLink, Wallet, AlertCircle,
  Loader, ShieldCheck, Building2, FileText, Clock, RefreshCw, Rocket, ArrowRight, Upload,
} from 'lucide-react';
import { useWeb3 } from '@/lib/web3-context';
import { useAuth } from '@/lib/auth-context';
import { OrgSearchPanel } from '@/components/org-search-panel';
import { ReanalyzePanel } from '@/components/reanalyze-panel';
import { toast } from 'sonner';
import { ethers } from 'ethers';
import { parseContractError } from '@/lib/utils';
import type { DbCampaign, DbMilestone, DbVerifierEndorsement, DbDonation } from '@/lib/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CampaignDetail {
  campaign:     DbCampaign;
  milestones:   DbMilestone[];
  endorsements: DbVerifierEndorsement[];
  donations:    DbDonation[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function trustBadgeClass(score: number | null) {
  if (score === null) return 'bg-muted text-muted-foreground';
  if (score >= 70)    return 'bg-success text-success-foreground';
  if (score >= 40)    return 'bg-warning text-warning-foreground';
  return 'bg-destructive text-destructive-foreground';
}

function statusBadgeClass(status: string) {
  if (status === 'active' || status === 'funded') return 'bg-success text-success-foreground';
  if (status === 'pending_verification')           return 'bg-warning text-warning-foreground';
  if (status === 'pending_review')                 return 'bg-warning text-warning-foreground';
  if (status === 'pending_ai')                     return 'bg-muted text-muted-foreground';
  if (status === 'completed')                      return 'bg-success text-success-foreground';
  if (status === 'rejected' || status === 'cancelled') return 'bg-destructive text-destructive-foreground';
  return 'bg-muted text-muted-foreground';
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    pending_ai:           'Analyzing…',
    pending_verification: 'Awaiting Verification',
    needs_more_proof:     'More Proof Needed',
    pending_review:       'Under Review',
    active:               'Active',
    funded:               'Funded',
    completed:            'Completed',
    cancelled:            'Cancelled',
    rejected:             'Rejected',
  };
  return map[status] ?? status;
}

function milestoneStatusClass(status: string) {
  if (status === 'released')             return 'bg-success text-success-foreground';
  if (status === 'withdrawal_requested') return 'bg-warning text-warning-foreground';
  if (status === 'rejected')             return 'bg-destructive text-destructive-foreground';
  return 'bg-muted text-muted-foreground';
}

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CampaignDetailPage() {
  const params     = useParams();
  const campaignId = params.id as string;
  const { contract, account, isConnected } = useWeb3();
  const { dbUser }                         = useAuth();

  const [data, setData]         = useState<CampaignDetail | null>(null);
  const [onChainRaised, setOnChainRaised] = useState<number | null>(null);
  const [loading, setLoading]   = useState(true);
  const [donating, setDonating] = useState(false);
  const [amount, setAmount]     = useState('');

  // Org search state (for pending_verification)
  const [orgTab, setOrgTab]               = useState<'verify' | 'improve'>('verify');
  const [orgSearch, setOrgSearch]         = useState('');
  const [orgTypeFilter, setOrgTypeFilter] = useState('');
  const [geoFilter, setGeoFilter]         = useState('');
  const [orgPage, setOrgPage]             = useState(1);
  const [orgs, setOrgs]                   = useState<any[]>([]);
  const [orgTotal, setOrgTotal]           = useState(0);
  const [orgTotalPages, setOrgTotalPages] = useState(0);
  const [orgLoading, setOrgLoading]       = useState(false);
  const [sentRequests, setSentRequests]   = useState<Set<string>>(new Set());
  const [requestNotes, setRequestNotes]   = useState<Record<string, string>>({});
  const [requestingOrg, setRequestingOrg] = useState<string | null>(null);

  // Re-analyze state (for needs_more_proof)
  const [resubmitFiles, setResubmitFiles] = useState<File[]>([]);
  const [reanalyzing, setReanalyzing]     = useState(false);
  const resubmitDocRef                    = useRef<HTMLInputElement | null>(null);

  // Withdrawal state (creator only)
  const [withdrawOpen, setWithdrawOpen]     = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawDesc, setWithdrawDesc]     = useState('');
  const [withdrawFile, setWithdrawFile]     = useState<File | null>(null);
  const [withdrawing, setWithdrawing]       = useState(false);
  const withdrawFileRef                     = useRef<HTMLInputElement | null>(null);
  const [withdrawals, setWithdrawals]       = useState<any[]>([]);

  // Fetch campaign from API
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}`);
        if (!res.ok) throw new Error('Not found');
        const json = await res.json() as CampaignDetail;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [campaignId]);

  // Fetch on-chain amount if contract_id is set
  useEffect(() => {
    if (!contract || !data?.campaign.contract_id) return;

    contract.getCampaign(data.campaign.contract_id)
      .then((c: { amountRaised?: bigint }) => {
        if (c.amountRaised !== undefined) {
          setOnChainRaised(Number(ethers.formatEther(c.amountRaised)));
        }
      })
      .catch(() => {/* ignore — use DB value */});
  }, [contract, data?.campaign.contract_id]);

  // Load orgs for verification
  const loadOrgs = useCallback(async (q: string, orgType: string, geo: string, page: number) => {
    if (!data?.campaign.category) return;
    setOrgLoading(true);
    try {
      const params = new URLSearchParams({
        status: 'active',
        domain: data.campaign.category,
        q, org_type: orgType, geographic_scope: geo,
        page: String(page), per_page: '6',
      });
      const res = await fetch(`/api/organizations?${params}`);
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setOrgs(json.orgs ?? []);
      setOrgTotal(json.total ?? 0);
      setOrgTotalPages(json.total_pages ?? 0);
    } catch {
      toast.error('Failed to load organizations');
    } finally {
      setOrgLoading(false);
    }
  }, [data?.campaign.category]);

  useEffect(() => {
    if (data?.campaign.status === 'pending_verification' && orgTab === 'verify') {
      loadOrgs(orgSearch, orgTypeFilter, geoFilter, orgPage);
    }
  }, [data?.campaign.status, orgTab, orgSearch, orgTypeFilter, geoFilter, orgPage, loadOrgs]);

  // Load withdrawals for milestone-aware display (creator needs this to compute next eligible)
  useEffect(() => {
    if (!data?.campaign.id) return;
    fetch(`/api/withdrawal-requests?campaignId=${data.campaign.id}`)
      .then((r) => r.ok ? r.json() : [])
      .then((rows) => setWithdrawals(Array.isArray(rows) ? rows : []));
  }, [data?.campaign.id]);

  // Request verification from org
  const handleRequestVerification = async (orgId: string) => {
    setRequestingOrg(orgId);
    try {
      const res = await fetch('/api/verification-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          organizationId: orgId,
          creatorNote:    requestNotes[orgId] ?? '',
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? 'Failed to send request');
        return;
      }
      setSentRequests((prev) => new Set([...prev, orgId]));
      toast.success('Verification request sent!');
    } catch {
      toast.error('Failed to send request');
    } finally {
      setRequestingOrg(null);
    }
  };

  // Creator withdrawal request
  const handleCreatorWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) { toast.error('Enter a valid amount'); return; }
    if (!withdrawDesc.trim()) { toast.error('Describe what you accomplished'); return; }
    if (!withdrawFile) { toast.error('Upload a proof document'); return; }
    if (!data?.campaign.contract_id) { toast.error('Publish campaign on-chain first'); return; }

    setWithdrawing(true);
    const tid = 'wr-' + campaignId;
    try {
      toast.loading('Uploading proof…', { id: tid });
      const form = new FormData();
      form.append('file', withdrawFile);
      const up = await fetch('/api/upload', { method: 'POST', body: form });
      if (!up.ok) throw new Error('Upload failed');
      const proofCid: string = (await up.json()).cid;

      let contractRequestId: number | null = null;
      if (contract) {
        toast.loading('Confirm transaction in MetaMask…', { id: tid });
        const amountWei = ethers.parseEther(withdrawAmount);
        const tx = await contract.submitWithdrawalRequest(data.campaign.contract_id, amountWei, proofCid);
        toast.loading('Waiting for confirmation…', { id: tid });
        const receipt = await tx.wait();
        for (const log of receipt.logs ?? []) {
          try {
            const parsed = contract.interface.parseLog(log);
            if (parsed?.name === 'WithdrawalRequested') { contractRequestId = Number(parsed.args[1]); break; }
          } catch { /* skip */ }
        }
      }

      toast.loading('Saving request…', { id: tid });
      const res = await fetch('/api/withdrawal-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id:          campaignId,
          milestone_id:         nextEligibleMilestone?.id,
          contract_request_id:  contractRequestId,
          requested_amount_eth: parseFloat(withdrawAmount),
          proof_ipfs_hash:      proofCid,
          proof_description:    withdrawDesc.trim(),
          status:               'pending',
        }),
      });
      if (!res.ok) throw new Error('Failed to save request');

      toast.success('Withdrawal request submitted — admin will review it', { id: tid });
      setWithdrawOpen(false);
      setWithdrawAmount('');
      setWithdrawDesc('');
      setWithdrawFile(null);
    } catch (err) {
      toast.error(parseContractError(err), { id: tid });
    } finally {
      setWithdrawing(false);
    }
  };

  // Re-analyze with new documents — upload files first, then send CIDs
  const handleReanalyze = async () => {
    if (!resubmitFiles.length) return;
    setReanalyzing(true);
    const tid = 'reanalyze-' + campaignId;
    try {
      toast.loading('Uploading documents…', { id: tid });
      const cids = await Promise.all(resubmitFiles.map(async (file) => {
        const form = new FormData();
        form.append('file', file);
        const up = await fetch('/api/upload', { method: 'POST', body: form });
        if (!up.ok) throw new Error('Upload failed');
        return (await up.json()).cid as string;
      }));

      toast.loading('Re-running AI analysis…', { id: tid });
      const res = await fetch(`/api/campaigns/${campaignId}/resubmit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIpfsCids: cids }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? 'Re-analysis failed', { id: tid });
        return;
      }
      const updated = await res.json();
      toast.success(`Re-analysis complete! New score: ${updated.ai_trust_score}`, { id: tid });
      setResubmitFiles([]);
      const refreshed = await fetch(`/api/campaigns/${campaignId}`);
      if (refreshed.ok) setData(await refreshed.json());
    } catch (err: any) {
      toast.error(err?.message ?? 'Re-analysis failed', { id: tid });
    } finally {
      setReanalyzing(false);
    }
  };

  // Copy invite link for orgs
  const copyInviteLink = async () => {
    try {
      const res = await fetch('/api/invite-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaignId, category: data?.campaign.category }),
      });
      if (!res.ok) throw new Error();
      const { token } = await res.json();
      const url = `${window.location.origin}/register/organization?invite=${token}`;
      await navigator.clipboard.writeText(url);
      toast.success('Invite link copied!');
    } catch {
      toast.error('Failed to generate invite link');
    }
  };

  // Publish unpublished campaign on-chain (creator only)
  const [publishing, setPublishing] = useState(false);
  const handlePublishOnChain = async () => {
    if (!contract) { toast.error('Connect your wallet first'); return; }
    if (!data?.campaign) return;
    const { campaign } = data;

    setPublishing(true);
    const ptid = 'publish-' + campaignId;
    try {
      toast.loading('Confirm transaction in MetaMask…', { id: ptid });
      const targetWei = ethers.parseEther(campaign.target_amount_eth.toString());
      const deadlineDate = campaign.deadline ? new Date(campaign.deadline) : new Date(Date.now() + 30 * 86400000);
      const daysLeft = Math.max(1, Math.ceil((deadlineDate.getTime() - Date.now()) / 86400000));
      const ipfsHash = campaign.ipfs_metadata_hash ?? 'QmNone';

      const tx      = await contract.createCampaign(targetWei, daysLeft, ipfsHash);
      toast.loading('Waiting for confirmation…', { id: ptid });
      const receipt = await tx.wait();

      // Parse contractId from CampaignCreated event
      let contractId: number | null = null;
      for (const log of receipt.logs ?? []) {
        try {
          const parsed = contract.interface.parseLog(log);
          if (parsed?.name === 'CampaignCreated') {
            contractId = Number(parsed.args[0]);
            break;
          }
        } catch { /* skip */ }
      }

      await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId }),
      });

      toast.success('Campaign published on blockchain!', { id: ptid });
      window.location.reload();
    } catch (err) {
      toast.error(parseContractError(err), { id: ptid });
    } finally {
      setPublishing(false);
    }
  };

  // Donate
  const handleDonate = async () => {
    if (!isConnected || !account) {
      toast.error('Connect your wallet first');
      return;
    }
    if (!contract) {
      toast.error('Contract not available — make sure Hardhat node is running and the contract address is correct');
      return;
    }
    if (!data?.campaign.contract_id) {
      toast.error('Campaign not yet published on-chain');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    setDonating(true);
    const dtid = 'donate-' + campaignId;
    try {
      toast.loading('Confirm in MetaMask…', { id: dtid });
      const amountWei = ethers.parseEther(amount);
      const tx        = await contract.donate(data.campaign.contract_id, { value: amountWei });

      toast.loading('Waiting for confirmation…', { id: dtid });
      const receipt = await tx.wait();

      // Record donation in Supabase
      await fetch('/api/donations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id:      campaignId,
          donor_wallet:     account?.toLowerCase(),
          amount_eth:       parseFloat(amount),
          transaction_hash: receipt.hash,
          status:           'confirmed',
        }),
      });

      toast.success('Donation confirmed!', { id: dtid });
      setAmount('');

      // Refresh data
      const res = await fetch(`/api/campaigns/${campaignId}`);
      if (res.ok) setData(await res.json());

      // Refresh on-chain amount
      const updated = await contract.getCampaign(data.campaign.contract_id);
      setOnChainRaised(Number(ethers.formatEther(updated.amountRaised)));
    } catch (err) {
      toast.error(parseContractError(err), { id: dtid });
    } finally {
      setDonating(false);
    }
  };

  // ── Loading / error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Campaign Not Found</h1>
            <p className="text-muted-foreground mb-4">The campaign you're looking for doesn't exist.</p>
            <Button asChild><Link href="/campaigns">Back to Campaigns</Link></Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const { campaign, milestones, endorsements, donations } = data;
  const displayRaised = onChainRaised ?? campaign.current_amount_eth;
  const pct           = campaign.target_amount_eth > 0
    ? Math.min((displayRaised / campaign.target_amount_eth) * 100, 100)
    : 0;
  const isCreator = (
    (account?.toLowerCase() === campaign.creator_wallet.toLowerCase()) ||
    (!!dbUser?.wallet_address && dbUser.wallet_address.toLowerCase() === campaign.creator_wallet.toLowerCase())
  );
  const canDonate = campaign.status === 'active';

  // Compute next eligible milestone for withdrawal
  const totalWithdrawn = withdrawals
    .filter((w: any) => w.status === 'approved')
    .reduce((s: number, w: any) => s + Number(w.requested_amount_eth), 0);
  const availableBalance = (campaign.current_amount_eth ?? 0) - totalWithdrawn;
  const nextEligibleMilestone = milestones.find((m, i) => {
    if (m.status !== 'pending') return false;
    return milestones.slice(0, i).every((p) => p.status === 'released');
  });
  const needsVerification = isCreator && campaign.status === 'pending_verification';
  const needsMoreProof    = isCreator && campaign.status === 'needs_more_proof';
  const sepoliaBase   = 'https://sepolia.etherscan.io';

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {/* Campaign image */}
        {campaign.image_url && (
          <div className="w-full h-56 md:h-72 overflow-hidden">
            <img src={campaign.image_url} alt={campaign.title} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="container mx-auto px-4 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* ── Main Content ── */}
            <div className="lg:col-span-2 space-y-6">
              {/* Title + badges */}
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <Badge variant="secondary" className="capitalize">{campaign.category}</Badge>
                  <Badge className={statusBadgeClass(campaign.status)}>
                    {statusLabel(campaign.status)}
                  </Badge>
                  {campaign.ai_trust_score != null && (
                    <Badge className={trustBadgeClass(campaign.ai_trust_score)}>
                      AI Trust: {campaign.ai_trust_score}
                    </Badge>
                  )}
                </div>
                <h1 className="text-3xl font-bold mb-4 text-balance">{campaign.title}</h1>
                <p className="text-lg text-muted-foreground leading-relaxed">{campaign.description}</p>
              </div>

              {/* ── Creator action panel ── */}
              {needsVerification && (
                <Card className="border-warning">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-warning-foreground">
                      <AlertCircle className="w-4 h-4" />
                      Your campaign needs verification
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      AI trust score: <strong>{campaign.ai_trust_score}/100</strong> — one endorsement
                      from a trusted organization will publish your campaign.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <Tabs value={orgTab} onValueChange={(v) => setOrgTab(v as 'verify' | 'improve')}>
                      <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="verify">Request Verification</TabsTrigger>
                        <TabsTrigger value="improve">Improve &amp; Re-analyze</TabsTrigger>
                      </TabsList>
                      <TabsContent value="verify">
                        <OrgSearchPanel
                          campaignId={campaignId}
                          category={campaign.category}
                          orgs={orgs}
                          orgLoading={orgLoading}
                          orgTotal={orgTotal}
                          orgPage={orgPage}
                          orgTotalPages={orgTotalPages}
                          orgSearch={orgSearch}
                          orgTypeFilter={orgTypeFilter}
                          geoFilter={geoFilter}
                          sentRequests={sentRequests}
                          requestNotes={requestNotes}
                          requestingOrg={requestingOrg}
                          onSearch={(q) => { setOrgSearch(q); setOrgPage(1); }}
                          onOrgTypeChange={(t) => { setOrgTypeFilter(t); setOrgPage(1); }}
                          onGeoChange={(g) => { setGeoFilter(g); setOrgPage(1); }}
                          onPageChange={setOrgPage}
                          onNoteChange={(id, note) => setRequestNotes((prev) => ({ ...prev, [id]: note }))}
                          onRequest={handleRequestVerification}
                          onInvite={copyInviteLink}
                        />
                      </TabsContent>
                      <TabsContent value="improve">
                        <ReanalyzePanel
                          files={resubmitFiles}
                          loading={reanalyzing}
                          inputRef={resubmitDocRef}
                          onFilesChange={setResubmitFiles}
                          onReanalyze={handleReanalyze}
                        />
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              )}

              {needsMoreProof && (
                <Card className="border-orange-400">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-orange-600 dark:text-orange-400">
                      <RefreshCw className="w-4 h-4" />
                      More proof needed
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      AI trust score: <strong>{campaign.ai_trust_score}/100</strong> — upload additional
                      supporting documents and re-run analysis to reach the 40+ threshold.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <ReanalyzePanel
                      files={resubmitFiles}
                      loading={reanalyzing}
                      inputRef={resubmitDocRef}
                      onFilesChange={setResubmitFiles}
                      onReanalyze={handleReanalyze}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Verifier endorsements */}
              {endorsements.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Verified By
                  </h2>
                  {endorsements.map((e) => {
                    const revoked = (e as any).is_revoked;
                    const tier    = (e as any).org_tier as number | undefined;
                    return (
                      <div
                        key={e.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border ${
                          revoked
                            ? 'bg-muted/30 border-muted opacity-60'
                            : 'bg-success/10 border-success/30'
                        }`}
                      >
                        <ShieldCheck className={`w-5 h-5 flex-shrink-0 mt-0.5 ${revoked ? 'text-muted-foreground' : 'text-success'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="font-medium text-sm">{e.verifier_org_name}</span>
                            {tier && (
                              <Badge variant="outline" className="text-xs">
                                Tier {tier} Verifier
                              </Badge>
                            )}
                            {revoked && (
                              <Badge variant="secondary" className="text-xs">
                                Endorsement Under Review
                              </Badge>
                            )}
                          </div>
                          {e.endorsement_note && (
                            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                              "{e.endorsement_note}"
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-1.5">
                            {e.corroborating_doc_ipfs && (
                              <a
                                href={`${process.env.NEXT_PUBLIC_PINATA_GATEWAY ?? 'https://gateway.pinata.cloud/ipfs/'}${e.corroborating_doc_ipfs}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                <FileText className="w-3 h-3" /> Endorsement document
                              </a>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {new Date(e.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* AI Verification breakdown */}
              {campaign.ai_explanation && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="w-4 h-4 text-primary" />
                      AI Verification Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Signal score bars — 5-signal weighted display */}
                    {campaign.ai_trust_score != null && (() => {
                      // Scale raw 0-25 scores to their new weight budgets for display
                      const t  = campaign.ai_text_score;
                      const s  = campaign.ai_semantic_score;
                      const a  = campaign.ai_amount_score;
                      const im = campaign.ai_image_score;
                      const dc = campaign.ai_document_score;

                      const signals: Array<{ label: string; score: number; max: number } | null> = [
                        t  != null ? { label: 'Text Quality',       score: Math.round(t  * 20 / 25), max: 20 } : null,
                        s  != null ? { label: 'Uniqueness',         score: Math.round(s  * 15 / 25), max: 15 } : null,
                        a  != null ? { label: 'Amount Reasonable',  score: Math.round(a  * 15 / 25), max: 15 } : null,
                        im != null ? { label: 'Image Authenticity', score: Math.round(im * 10 / 25), max: 10 } : null,
                        dc != null ? { label: 'Document Evidence',  score: dc, max: 40 } : null,
                      ];

                      const visible = signals.filter(Boolean) as Array<{ label: string; score: number; max: number }>;
                      if (!visible.length) return null;

                      return (
                        <div className="space-y-2">
                          {visible.map(({ label, score, max }) => (
                            <div key={label} className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground w-36 flex-shrink-0">{label}</span>
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    score / max >= 0.7 ? 'bg-success' : score / max >= 0.4 ? 'bg-warning' : 'bg-destructive'
                                  }`}
                                  style={{ width: `${(score / max) * 100}%` }}
                                />
                              </div>
                              <span className="text-xs font-mono text-muted-foreground w-12 text-right">{score}/{max}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {campaign.ai_explanation}
                    </p>
                    {campaign.ai_flags && (campaign.ai_flags as string[]).length > 0 && (
                      <div className="space-y-1">
                        {(campaign.ai_flags as string[]).map((f) => (
                          <div key={f} className="flex items-center gap-2 text-xs text-warning">
                            <AlertCircle className="w-3 h-3 flex-shrink-0" />
                            <span>{f.replace(/_/g, ' ')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Tabs: Milestones / Donations / Details */}
              <div className="flex justify-end">
                <Button asChild variant="outline" size="sm" className="gap-2">
                  <Link href={`/campaigns/${campaignId}/transparency`}>
                    <Clock className="w-4 h-4" /> Transparency Timeline
                  </Link>
                </Button>
              </div>

              <Tabs defaultValue="milestones" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="milestones">
                    Milestones ({milestones.length})
                  </TabsTrigger>
                  <TabsTrigger value="donations">
                    Donations ({donations.length})
                  </TabsTrigger>
                  <TabsTrigger value="details">Details</TabsTrigger>
                </TabsList>

                <TabsContent value="milestones" className="space-y-3 mt-6">
                  {milestones.length === 0 ? (
                    <Alert><AlertDescription>No milestones defined.</AlertDescription></Alert>
                  ) : (
                    milestones.map((m, i) => {
                      const isLocked = milestones.slice(0, i).some((p) => p.status !== 'released');
                      const statusInfo = (() => {
                        if (m.status === 'released')             return { label: 'Released',  cls: 'bg-success text-success-foreground' };
                        if (m.status === 'withdrawal_requested') return { label: 'In Review', cls: 'bg-warning text-warning-foreground' };
                        if (isLocked)                            return { label: 'Locked',    cls: 'bg-muted text-muted-foreground' };
                        return { label: 'Eligible', cls: 'bg-primary/20 text-primary' };
                      })();
                      return (
                        <Card key={m.id} className={`p-4 ${isLocked && m.status === 'pending' ? 'opacity-60' : ''}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-sm font-medium flex-shrink-0">
                                {m.status === 'released' ? <CheckCircle className="w-4 h-4 text-success" /> : i + 1}
                              </div>
                              <div>
                                <p className="font-medium text-sm">{m.title}</p>
                                <p className="text-sm text-muted-foreground mt-0.5">{m.description}</p>
                                <p className="text-sm font-medium mt-1">{m.target_amount_eth} ETH</p>
                              </div>
                            </div>
                            <Badge className={statusInfo.cls} variant="secondary">
                              {statusInfo.label}
                            </Badge>
                          </div>
                        </Card>
                      );
                    })
                  )}
                </TabsContent>

                <TabsContent value="donations" className="space-y-3 mt-6">
                  {donations.length === 0 ? (
                    <Alert><AlertDescription>No donations recorded yet — be the first!</AlertDescription></Alert>
                  ) : (
                    donations.map((d) => (
                      <div key={d.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <code className="text-sm">{shortenAddress(d.donor_wallet)}</code>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(d.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold">{d.amount_eth} ETH</span>
                          {d.transaction_hash && (
                            <a
                              href={`${sepoliaBase}/tx/${d.transaction_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:text-primary/80"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="details" className="mt-6">
                  <Card>
                    <CardContent className="pt-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground mb-1">Creator</p>
                          <code className="bg-muted px-2 py-1 rounded text-xs">
                            {shortenAddress(campaign.creator_wallet)}
                          </code>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1">Deadline</p>
                          <p>{campaign.deadline
                            ? new Date(campaign.deadline).toLocaleDateString()
                            : 'Not set'}</p>
                        </div>
                        {campaign.contract_id !== null && campaign.contract_id !== undefined && (
                          <div>
                            <p className="text-muted-foreground mb-1">On-chain ID</p>
                            <p>#{campaign.contract_id}</p>
                          </div>
                        )}
                        {campaign.ipfs_metadata_hash && (
                          <div>
                            <p className="text-muted-foreground mb-1">IPFS</p>
                            <a
                              href={`https://gateway.pinata.cloud/ipfs/${campaign.ipfs_metadata_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary text-xs hover:underline"
                            >
                              {campaign.ipfs_metadata_hash.slice(0, 16)}…
                            </a>
                          </div>
                        )}
                      </div>

                      {isCreator && (
                        <Alert className="bg-primary/10 border-primary">
                          <AlertDescription>You are the creator of this campaign.</AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            {/* ── Donation Sidebar ── */}
            <div className="lg:col-span-1">
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle>Support This Campaign</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Progress */}
                  <div className="space-y-2">
                    <div className="flex items-end justify-between">
                      <span className="text-2xl font-bold">{displayRaised.toFixed(3)} ETH</span>
                      <span className="text-muted-foreground text-sm">
                        of {campaign.target_amount_eth.toFixed(2)} ETH
                      </span>
                    </div>
                    <Progress value={pct} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{pct.toFixed(1)}% funded</span>
                      <span>{donations.length} donor{donations.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  {/* Publish on-chain banner — creator only, when contract_id is missing */}
                  {isCreator && !campaign.contract_id && canDonate && (
                    <Alert className="border-primary bg-primary/10">
                      <AlertCircle className="w-4 h-4" />
                      <AlertDescription className="space-y-3">
                        <p className="text-sm font-medium">This campaign is approved but not yet registered on-chain.</p>
                        <p className="text-xs text-muted-foreground">
                          One MetaMask transaction is required to create the escrow entry before donors can contribute.
                        </p>
                        <Button
                          size="sm"
                          className="w-full gap-2"
                          disabled={publishing || !contract}
                          onClick={handlePublishOnChain}
                        >
                          {publishing ? (
                            <><Loader className="w-3.5 h-3.5 animate-spin" /> Publishing…</>
                          ) : (
                            <><Rocket className="w-3.5 h-3.5" /> Publish on Blockchain</>
                          )}
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Status alerts */}
                  {campaign.status === 'pending_verification' && (
                    <Alert className="border-warning bg-warning/10">
                      <AlertCircle className="w-4 h-4" />
                      <AlertDescription className="text-sm">
                        This campaign is awaiting verification by a trusted organization.
                        Donations are paused until verified.
                      </AlertDescription>
                    </Alert>
                  )}

                  {campaign.status === 'pending_review' && (
                    <Alert className="border-warning bg-warning/10">
                      <AlertCircle className="w-4 h-4" />
                      <AlertDescription className="text-sm">
                        Under admin review. Donations will open once approved.
                      </AlertDescription>
                    </Alert>
                  )}

                  {campaign.status === 'needs_more_proof' && (
                    <Alert className="border-orange-400 bg-orange-50/50 dark:bg-orange-950/20">
                      <AlertCircle className="w-4 h-4 text-orange-500" />
                      <AlertDescription className="text-sm">
                        More documentation required before this campaign can go live.
                      </AlertDescription>
                    </Alert>
                  )}

                  {campaign.status === 'funded' && (
                    <Alert className="bg-success/10 border-success">
                      <CheckCircle className="w-4 h-4 text-success" />
                      <AlertDescription className="text-sm font-medium">
                        Goal reached! This campaign is fully funded.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Donation input */}
                  {canDonate && (
                    <>
                      {!isConnected ? (
                        <Alert className="border-warning bg-warning/10">
                          <AlertCircle className="w-4 h-4" />
                          <AlertDescription className="text-sm">
                            Connect your wallet to donate.
                          </AlertDescription>
                        </Alert>
                      ) : !contract ? (
                        <Alert className="border-warning bg-warning/10">
                          <AlertCircle className="w-4 h-4" />
                          <AlertDescription className="text-sm">
                            Wallet connected but contract not reachable. Make sure MetaMask is on the correct network (localhost:8545 for local dev, Polygon Amoy for testnet).
                          </AlertDescription>
                        </Alert>
                      ) : null}

                      <div className="space-y-3">
                        <label className="text-sm font-medium">Amount (ETH)</label>
                        <Input
                          type="number"
                          placeholder="0.1"
                          step="0.01"
                          min="0.001"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          disabled={!isConnected || donating}
                        />
                        <div className="grid grid-cols-3 gap-2">
                          {[0.1, 0.5, 1].map((v) => (
                            <Button
                              key={v}
                              variant="outline"
                              size="sm"
                              onClick={() => setAmount(v.toString())}
                              disabled={!isConnected}
                            >
                              {v} ETH
                            </Button>
                          ))}
                        </div>
                      </div>

                      <Button
                        onClick={handleDonate}
                        disabled={!isConnected || !contract || donating || !amount}
                        size="lg"
                        className="w-full gap-2"
                      >
                        {donating ? (
                          <><Loader className="w-4 h-4 animate-spin" /> Processing…</>
                        ) : (
                          <><Wallet className="w-4 h-4" /> Donate Now</>
                        )}
                      </Button>
                    </>
                  )}

                  {/* Trust info */}
                  <div className="pt-4 border-t space-y-2 text-xs text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <Shield className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                      <p>Funds held in a smart contract — released only on verified milestones.</p>
                    </div>
                    {endorsements.length > 0 && (
                      <div className="flex items-start gap-2">
                        <ShieldCheck className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
                        <p>Endorsed by {endorsements.length} trusted organization{endorsements.length !== 1 ? 's' : ''}.</p>
                      </div>
                    )}
                    {campaign.contract_id !== null && campaign.contract_id !== undefined && (
                      <a
                        href={`${sepoliaBase}/address/${process.env.NEXT_PUBLIC_CONTRACT_ADDRESS}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View contract on Etherscan
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
              {/* Creator withdrawal card — show when campaign is active or funded */}
              {isCreator && (campaign.status === 'active' || campaign.status === 'funded') && (
                <Card className="mt-4">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ArrowRight className="w-4 h-4" />
                      Request Withdrawal
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!data?.campaign.contract_id ? (
                      <p className="text-xs text-muted-foreground">
                        Publish this campaign on-chain first (button above) before requesting withdrawals.
                      </p>
                    ) : !nextEligibleMilestone && milestones.length > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No milestone is currently eligible. All are locked, in review, or released.
                      </p>
                    ) : nextEligibleMilestone && availableBalance < nextEligibleMilestone.target_amount_eth ? (
                      <p className="text-xs text-muted-foreground">
                        Next milestone: <strong>{nextEligibleMilestone.title}</strong> ({nextEligibleMilestone.target_amount_eth} ETH).
                        Available balance: {availableBalance.toFixed(4)} ETH — more donations needed.
                      </p>
                    ) : !withdrawOpen ? (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          setWithdrawOpen(true);
                          if (nextEligibleMilestone) {
                            setWithdrawAmount(nextEligibleMilestone.target_amount_eth.toString());
                          }
                        }}
                      >
                        {nextEligibleMilestone
                          ? `Request: ${nextEligibleMilestone.title}`
                          : 'Request Withdrawal'}
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        {nextEligibleMilestone && (
                          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded text-xs">
                            <CheckCircle className="w-3.5 h-3.5 text-success flex-shrink-0" />
                            <span className="text-muted-foreground">Milestone:</span>
                            <span className="font-medium">{nextEligibleMilestone.title}</span>
                          </div>
                        )}
                        <div>
                          <label className="text-xs font-medium">Amount (ETH)</label>
                          <Input
                            type="number" placeholder="0.5" step="0.01" min="0.001"
                            value={withdrawAmount}
                            onChange={(e) => setWithdrawAmount(e.target.value)}
                            disabled={withdrawing}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium">What did you accomplish?</label>
                          <Textarea
                            placeholder="Describe the milestone completed and how funds were used"
                            value={withdrawDesc}
                            onChange={(e) => setWithdrawDesc(e.target.value)}
                            rows={3}
                            disabled={withdrawing}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium">Proof document</label>
                          <input
                            ref={withdrawFileRef}
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                            className="hidden"
                            onChange={(e) => setWithdrawFile(e.target.files?.[0] ?? null)}
                          />
                          <Button
                            variant="outline" size="sm" className="w-full gap-2 mt-1"
                            onClick={() => withdrawFileRef.current?.click()}
                            disabled={withdrawing}
                          >
                            <Upload className="w-3.5 h-3.5" />
                            {withdrawFile ? withdrawFile.name : 'Upload proof (PDF/image)'}
                          </Button>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline" size="sm" className="flex-1"
                            onClick={() => setWithdrawOpen(false)}
                            disabled={withdrawing}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm" className="flex-1 gap-2"
                            onClick={handleCreatorWithdraw}
                            disabled={withdrawing}
                          >
                            {withdrawing ? <Loader className="w-3.5 h-3.5 animate-spin" /> : null}
                            Submit
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

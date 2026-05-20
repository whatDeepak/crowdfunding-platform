'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useWeb3 } from '@/lib/web3-context';
import { toast } from 'sonner';
import { ethers } from 'ethers';
import {
  Loader, Plus, ArrowRight, AlertCircle, FileText,
  Upload, CheckCircle, ChevronDown, ChevronUp, ExternalLink, RefreshCw, X, Building2, Send, Lock, Trash2,
} from 'lucide-react';
import type { DbCampaign, DbMilestone, DbWithdrawalRequest, DbOrganization } from '@/lib/types';

interface CampaignDetail {
  campaign:  DbCampaign;
  milestones: DbMilestone[];
  withdrawals: DbWithdrawalRequest[];
}

function statusBadgeClass(status: string) {
  if (status === 'active' || status === 'funded') return 'bg-success text-success-foreground';
  if (status.startsWith('pending_')) return 'bg-warning text-warning-foreground';
  if (status === 'needs_more_proof') return 'bg-destructive/80 text-destructive-foreground';
  if (status === 'completed') return 'bg-primary text-primary-foreground';
  if (status === 'rejected' || status === 'cancelled') return 'bg-destructive text-destructive-foreground';
  return 'bg-muted text-muted-foreground';
}

async function uploadFile(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/upload', { method: 'POST', body: form });
  if (!res.ok) throw new Error('Upload failed');
  return (await res.json()).cid as string;
}

export default function MyCampaignsPage() {
  const { account, isConnected, connectWallet, contract } = useWeb3();

  const [campaigns, setCampaigns]     = useState<DbCampaign[]>([]);
  const [details, setDetails]         = useState<Record<string, CampaignDetail>>({});
  const [loading, setLoading]         = useState(false);
  const [expanded, setExpanded]       = useState<string | null>(null);
  const [showWithdraw, setShowWithdraw] = useState<string | null>(null);

  // Withdrawal form state per campaign
  const [wForm, setWForm]   = useState<Record<string, {
    milestoneId: string;
    amount:      string;
    description: string;
    proofFile:   File | null;
  }>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resubmit state
  const [resubmitFiles, setResubmitFiles] = useState<Record<string, File[]>>({});
  const [resubmitting, setResubmitting]   = useState<string | null>(null);
  const resubmitFileRef = useRef<HTMLInputElement>(null);

  // Get Verified panel state
  const [matchingOrgs, setMatchingOrgs]           = useState<Record<string, DbOrganization[]>>({});
  const [verifyNotes, setVerifyNotes]             = useState<Record<string, string>>({});
  const [requestingVerify, setRequestingVerify]   = useState<string | null>(null);
  const [sentRequests, setSentRequests]           = useState<Record<string, Set<string>>>({}); // campaignId → orgId set

  useEffect(() => {
    if (!account) return;
    setLoading(true);
    fetch(`/api/campaigns?creator=${account}`)
      .then((r) => r.ok ? r.json() : [])
      .then(setCampaigns)
      .finally(() => setLoading(false));
  }, [account]);

  const loadDetail = async (campaignId: string) => {
    if (details[campaignId]) return;
    const [detailRes, wRes] = await Promise.all([
      fetch(`/api/campaigns/${campaignId}`),
      fetch(`/api/withdrawal-requests?campaignId=${campaignId}`),
    ]);
    const detailData = detailRes.ok ? await detailRes.json() : null;
    const wData      = wRes.ok ? await wRes.json() : [];

    if (detailData) {
      setDetails((prev) => ({
        ...prev,
        [campaignId]: {
          campaign:    detailData.campaign,
          milestones:  detailData.milestones ?? [],
          withdrawals: Array.isArray(wData) ? wData : [],
        },
      }));
    }
  };

  const toggleExpand = async (id: string) => {
    const next = expanded === id ? null : id;
    setExpanded(next);
    if (next) await loadDetail(next);
  };

  const getWForm = (id: string) =>
    wForm[id] ?? { milestoneId: '', amount: '', description: '', proofFile: null };

  const setWField = (id: string, patch: Partial<ReturnType<typeof getWForm>>) =>
    setWForm((prev) => ({ ...prev, [id]: { ...getWForm(id), ...patch } }));

  const handleWithdrawSubmit = async (campaign: DbCampaign) => {
    const f = getWForm(campaign.id);
    if (!f.amount || parseFloat(f.amount) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (!f.description.trim()) {
      toast.error('Describe what you accomplished');
      return;
    }
    if (!f.proofFile) {
      toast.error('Upload at least one proof document');
      return;
    }

    setSubmitting(campaign.id);
    const tid = 'withdraw-' + campaign.id;
    try {
      // 1. Upload proof to IPFS
      toast.loading('Uploading proof document…', { id: tid });
      const proofCid = await uploadFile(f.proofFile);

      // 2. Submit on-chain (if contract_id is set)
      let contractRequestId: number | null = null;
      if (contract && campaign.contract_id != null) {
        toast.loading('Confirm transaction in MetaMask…', { id: tid });
        const amountWei = ethers.parseEther(f.amount);
        const tx = await contract.submitWithdrawalRequest(
          campaign.contract_id,
          amountWei,
          proofCid
        );
        toast.loading('Waiting for confirmation…', { id: tid });
        const receipt = await tx.wait();

        // Parse request ID from WithdrawalRequested event
        for (const log of receipt.logs ?? []) {
          try {
            const parsed = contract.interface.parseLog(log);
            if (parsed?.name === 'WithdrawalRequested') {
              contractRequestId = Number(parsed.args[1]);
              break;
            }
          } catch { /* skip */ }
        }
      }

      // 3. Create DB record
      toast.loading('Saving withdrawal request…', { id: tid });
      const res = await fetch('/api/withdrawal-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id:         campaign.id,
          milestone_id:        f.milestoneId || undefined,
          contract_request_id: contractRequestId,
          requested_amount_eth: parseFloat(f.amount),
          proof_ipfs_hash:     proofCid,
          proof_description:   f.description.trim(),
          status:              'pending',
        }),
      });
      if (!res.ok) throw new Error('Failed to save withdrawal request');
      const wr = await res.json();

      // 4. Run AI proof analysis
      fetch('/api/ai/analyze-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ withdrawalRequestId: wr.id }),
      }).catch(() => {/* fire and forget */});

      toast.success('Withdrawal request submitted for admin review!', { id: tid });
      setShowWithdraw(null);

      // Refresh detail
      setDetails((prev) => {
        const existing = prev[campaign.id];
        if (!existing) return prev;
        return {
          ...prev,
          [campaign.id]: {
            ...existing,
            withdrawals: [...existing.withdrawals, wr],
          },
        };
      });
    } catch (err: any) {
      toast.error(err?.shortMessage ?? err?.message ?? 'Submission failed', { id: tid });
    } finally {
      setSubmitting(null);
    }
  };

  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!window.confirm('Delete this campaign? This cannot be undone.')) return;
    setDeleting(campaignId);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? 'Failed to delete campaign');
        return;
      }
      toast.success('Campaign deleted');
      setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
      setDetails((prev) => { const next = { ...prev }; delete next[campaignId]; return next; });
    } catch {
      toast.error('Failed to delete campaign');
    } finally {
      setDeleting(null);
    }
  };

  // Submit an existing withdrawal request on-chain (for requests saved without contract_request_id)
  const [submittingOnChain, setSubmittingOnChain] = useState<string | null>(null);
  const handleSubmitOnChain = async (campaign: DbCampaign, w: DbWithdrawalRequest) => {
    if (!contract || campaign.contract_id == null) {
      toast.error('Campaign is not published on-chain yet');
      return;
    }
    setSubmittingOnChain(w.id);
    const tid = 'onchain-' + w.id;
    try {
      toast.loading('Confirm transaction in MetaMask…', { id: tid });
      const amountWei = ethers.parseEther(w.requested_amount_eth.toString());
      const tx = await contract.submitWithdrawalRequest(
        campaign.contract_id,
        amountWei,
        w.proof_ipfs_hash ?? ''
      );
      toast.loading('Waiting for confirmation…', { id: tid });
      const receipt = await tx.wait();

      let contractRequestId: number | null = null;
      for (const log of receipt.logs ?? []) {
        try {
          const parsed = contract.interface.parseLog(log);
          if (parsed?.name === 'WithdrawalRequested') {
            contractRequestId = Number(parsed.args[1]);
            break;
          }
        } catch { /* skip */ }
      }

      if (contractRequestId == null) throw new Error('Could not read request ID from transaction');

      await fetch(`/api/withdrawal-requests/${w.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contract_request_id: contractRequestId }),
      });

      toast.success('Withdrawal submitted on-chain — admin can now approve it', { id: tid });
      // Update local state
      setDetails((prev) => {
        const d = prev[campaign.id];
        if (!d) return prev;
        return {
          ...prev,
          [campaign.id]: {
            ...d,
            withdrawals: d.withdrawals.map((wr) =>
              wr.id === w.id ? { ...wr, contract_request_id: contractRequestId } : wr
            ),
          },
        };
      });
    } catch (err: any) {
      toast.error(err?.shortMessage ?? err?.message ?? 'Transaction failed', { id: tid });
    } finally {
      setSubmittingOnChain(null);
    }
  };

  const handleResubmit = async (campaign: DbCampaign) => {
    const files = resubmitFiles[campaign.id] ?? [];
    if (files.length === 0) {
      toast.error('Upload at least one new document before re-analyzing');
      return;
    }

    setResubmitting(campaign.id);
    const rtid = 'resubmit-' + campaign.id;
    try {
      toast.loading('Uploading documents…', { id: rtid });
      const cids = await Promise.all(files.map(uploadFile));

      toast.loading('Re-running AI analysis…', { id: rtid });
      const res = await fetch(`/api/campaigns/${campaign.id}/resubmit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIpfsCids: cids }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Re-analysis failed', { id: rtid });
        return;
      }

      toast.success(
        data.campaign_status === 'active'
          ? 'Your campaign is now live!'
          : data.campaign_status === 'pending_verification'
          ? 'Score improved — awaiting verifier endorsement'
          : 'Analysis complete. Check your updated score.',
        { id: rtid }
      );

      // Refresh campaign list
      setResubmitFiles((prev) => ({ ...prev, [campaign.id]: [] }));
      if (account) {
        setLoading(true);
        fetch(`/api/campaigns?creator=${account}`)
          .then((r) => r.ok ? r.json() : [])
          .then(setCampaigns)
          .finally(() => setLoading(false));
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Re-analysis failed', { id: rtid });
    } finally {
      setResubmitting(null);
    }
  };

  const loadMatchingOrgs = async (campaign: DbCampaign) => {
    if (matchingOrgs[campaign.id]) return;
    const res = await fetch(`/api/organizations?status=active&domain=${campaign.category}&per_page=20`);
    if (!res.ok) return;
    const json = await res.json();
    const orgs: DbOrganization[] = json.orgs ?? [];
    setMatchingOrgs((prev) => ({ ...prev, [campaign.id]: orgs }));
  };

  const handleRequestVerification = async (campaign: DbCampaign, orgId: string) => {
    setRequestingVerify(orgId);
    try {
      const res = await fetch('/api/verification-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId:     campaign.id,
          organizationId: orgId,
          creatorNote:    verifyNotes[`${campaign.id}-${orgId}`]?.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Request failed');
        return;
      }
      toast.success('Verification request sent to organization!');
      setSentRequests((prev) => ({
        ...prev,
        [campaign.id]: new Set([...(prev[campaign.id] ?? []), orgId]),
      }));
    } catch {
      toast.error('Request failed');
    } finally {
      setRequestingVerify(null);
    }
  };

  if (!isConnected) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Button onClick={connectWallet}>Connect MetaMask</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">My Campaigns</h1>
          <Button asChild>
            <Link href="/create-campaign">
              <Plus className="mr-2 h-4 w-4" /> New Campaign
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground mb-4">You haven't created any campaigns yet.</p>
            <Button asChild>
              <Link href="/create-campaign">Create Your First Campaign</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {campaigns.map((c) => {
              const pct      = c.target_amount_eth > 0
                ? Math.min((c.current_amount_eth / c.target_amount_eth) * 100, 100)
                : 0;
              const isOpen   = expanded === c.id;
              const detail   = details[c.id];
              const canWithdraw = c.status === 'active' || c.status === 'funded';
              const isDeletable = c.contract_id == null && ['pending_ai', 'pending_verification', 'pending_review', 'needs_more_proof', 'rejected'].includes(c.status);

              return (
                <Card key={c.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap gap-2 mb-1.5">
                          <Badge className={statusBadgeClass(c.status)}>
                            {c.status.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())}
                          </Badge>
                          {c.ai_trust_score != null && (
                            <Badge variant="secondary">Trust: {c.ai_trust_score}</Badge>
                          )}
                        </div>
                        <CardTitle className="text-lg leading-tight">{c.title}</CardTitle>
                        <div className="flex items-center gap-3 mt-2">
                          <Progress value={pct} className="h-1.5 w-32" />
                          <span className="text-xs text-muted-foreground">
                            {c.current_amount_eth.toFixed(3)} / {c.target_amount_eth.toFixed(2)} ETH
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/campaigns/${c.id}`} target="_blank">
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        </Button>
                        {isDeletable && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={deleting === c.id}
                            onClick={() => handleDeleteCampaign(c.id)}
                          >
                            {deleting === c.id
                              ? <Loader className="w-4 h-4 animate-spin" />
                              : <Trash2 className="w-4 h-4" />}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpand(c.id)}
                        >
                          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  {isOpen && (
                    <CardContent className="space-y-5 pt-0">
                      {!detail ? (
                        <div className="flex justify-center py-4">
                          <Loader className="w-5 h-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <>
                          {/* Milestones — status-aware display */}
                          {detail.milestones.length > 0 && (() => {
                            const totalWithdrawn = detail.withdrawals
                              .filter((w) => w.status === 'approved')
                              .reduce((s, w) => s + Number(w.requested_amount_eth), 0);
                            const availableBalance = c.current_amount_eth - totalWithdrawn;

                            const nextEligibleMilestone = detail.milestones.find((m, i) => {
                              if (m.status !== 'pending') return false;
                              return detail.milestones.slice(0, i).every((p) => p.status === 'released');
                            });

                            const canRequestWithdrawal =
                              canWithdraw &&
                              c.contract_id != null &&
                              nextEligibleMilestone != null &&
                              availableBalance >= (nextEligibleMilestone.target_amount_eth ?? Infinity);

                            return (
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-sm font-medium">Milestones</p>
                                  {canWithdraw && c.contract_id != null && (
                                    <span className="text-xs text-muted-foreground">
                                      Available: {availableBalance.toFixed(4)} ETH
                                    </span>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  {detail.milestones.map((m, i) => {
                                    const isLocked = detail.milestones.slice(0, i).some((p) => p.status !== 'released');
                                    const milestoneStatusInfo = (() => {
                                      if (m.status === 'released')             return { label: 'Released',   cls: 'bg-success text-success-foreground' };
                                      if (m.status === 'withdrawal_requested') return { label: 'In Review',  cls: 'bg-warning text-warning-foreground' };
                                      if (isLocked)                            return { label: 'Locked',     cls: 'bg-muted text-muted-foreground' };
                                      return { label: 'Eligible', cls: 'bg-primary/20 text-primary' };
                                    })();
                                    return (
                                      <div
                                        key={m.id}
                                        className="flex items-center justify-between p-2.5 bg-muted/40 rounded-lg text-sm"
                                      >
                                        <div className="flex items-center gap-2">
                                          {isLocked && m.status === 'pending' && (
                                            <Lock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                          )}
                                          <span className="font-medium">{i + 1}. {m.title}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-muted-foreground">{m.target_amount_eth} ETH</span>
                                          <Badge className={`text-xs ${milestoneStatusInfo.cls}`}>
                                            {milestoneStatusInfo.label}
                                          </Badge>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Withdrawal button — milestone-aware */}
                                {canWithdraw && (
                                  <div className="mt-3">
                                    {c.contract_id == null ? (
                                      <Alert className="border-warning bg-warning/10">
                                        <AlertCircle className="w-4 h-4" />
                                        <AlertDescription className="text-xs">
                                          Publish this campaign on-chain first before requesting a withdrawal.{' '}
                                          <Link href={`/campaigns/${c.id}`} className="underline font-medium">
                                            Go to campaign page →
                                          </Link>
                                        </AlertDescription>
                                      </Alert>
                                    ) : !nextEligibleMilestone ? (
                                      <p className="text-xs text-muted-foreground text-center py-2">
                                        No eligible milestones — all are locked, in review, or released.
                                      </p>
                                    ) : !canRequestWithdrawal ? (
                                      <Alert className="border-warning bg-warning/10">
                                        <AlertCircle className="w-4 h-4" />
                                        <AlertDescription className="text-xs">
                                          Available balance ({availableBalance.toFixed(4)} ETH) is less than the next milestone amount ({nextEligibleMilestone.target_amount_eth} ETH).
                                          More donations are needed.
                                        </AlertDescription>
                                      </Alert>
                                    ) : showWithdraw === c.id ? (
                                      <WithdrawForm
                                        campaign={c}
                                        milestones={detail.milestones}
                                        nextMilestone={nextEligibleMilestone}
                                        form={getWForm(c.id)}
                                        onChange={(patch) => setWField(c.id, patch)}
                                        onSubmit={() => handleWithdrawSubmit(c)}
                                        onCancel={() => setShowWithdraw(null)}
                                        submitting={submitting === c.id}
                                        fileInputRef={fileInputRef}
                                      />
                                    ) : (
                                      <Button
                                        variant="outline"
                                        onClick={() => {
                                          setShowWithdraw(c.id);
                                          setWField(c.id, {
                                            milestoneId: nextEligibleMilestone.id,
                                            amount:      nextEligibleMilestone.target_amount_eth.toString(),
                                          });
                                        }}
                                        className="w-full gap-2"
                                      >
                                        <ArrowRight className="w-4 h-4" />
                                        Request Withdrawal for: {nextEligibleMilestone.title}
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Past withdrawals (when no milestones exist) */}
                          {detail.withdrawals.length > 0 && (
                            <div>
                              <p className="text-sm font-medium mb-2">Withdrawal Requests</p>
                              <div className="space-y-2">
                                {detail.withdrawals.map((w) => {
                                  const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID ?? '31337');
                                  const explorerBase = chainId === 80002
                                    ? 'https://amoy.polygonscan.com'
                                    : chainId === 11155111
                                    ? 'https://sepolia.etherscan.io'
                                    : null;

                                  return (
                                    <div
                                      key={w.id}
                                      className="flex flex-col gap-1.5 p-2.5 border rounded-lg text-sm"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="truncate text-muted-foreground">{w.proof_description?.slice(0, 40) ?? 'Request'}…</span>
                                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                          <span className="font-medium">{w.requested_amount_eth} ETH</span>
                                          <Badge
                                            variant="secondary"
                                            className={
                                              w.status === 'approved' ? 'bg-success text-success-foreground' :
                                              w.status === 'rejected' ? 'bg-destructive text-destructive-foreground' :
                                              ''
                                            }
                                          >
                                            {w.status}
                                          </Badge>
                                        </div>
                                      </div>

                                      {/* Approved: show release confirmation */}
                                      {w.status === 'approved' && (
                                        <div className="flex items-center gap-1.5 text-xs text-success">
                                          <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                          <span>ETH released to your wallet</span>
                                          {w.admin_tx_hash && explorerBase && (
                                            <a
                                              href={`${explorerBase}/tx/${w.admin_tx_hash}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-0.5 text-primary underline ml-1"
                                            >
                                              tx <ExternalLink className="w-2.5 h-2.5" />
                                            </a>
                                          )}
                                          {w.admin_tx_hash && !explorerBase && (
                                            <span className="text-muted-foreground ml-1 font-mono">
                                              {w.admin_tx_hash.slice(0, 10)}…
                                            </span>
                                          )}
                                        </div>
                                      )}

                                      {/* Rejected: show reason */}
                                      {w.status === 'rejected' && w.rejection_reason && (
                                        <p className="text-xs text-destructive">{w.rejection_reason}</p>
                                      )}

                                      {/* Pending without on-chain ID: prompt to submit */}
                                      {w.status === 'pending' && w.contract_request_id == null && c.contract_id != null && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="w-full gap-1.5 border-warning text-warning hover:bg-warning/10"
                                          disabled={submittingOnChain === w.id}
                                          onClick={() => handleSubmitOnChain(c, w)}
                                        >
                                          {submittingOnChain === w.id
                                            ? <Loader className="w-3.5 h-3.5 animate-spin" />
                                            : <Send className="w-3.5 h-3.5" />
                                          }
                                          Submit On-Chain (required for admin approval)
                                        </Button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Withdrawal button shown inline with milestones above — only show standalone when no milestones */}
                          {canWithdraw && detail.milestones.length === 0 && (
                            <div>
                              {c.contract_id == null ? (
                                <Alert className="border-warning bg-warning/10">
                                  <AlertCircle className="w-4 h-4" />
                                  <AlertDescription className="text-xs">
                                    Publish this campaign on-chain first before requesting a withdrawal.{' '}
                                    <Link href={`/campaigns/${c.id}`} className="underline font-medium">
                                      Go to campaign page →
                                    </Link>
                                  </AlertDescription>
                                </Alert>
                              ) : showWithdraw === c.id ? (
                                <WithdrawForm
                                  campaign={c}
                                  milestones={detail.milestones}
                                  form={getWForm(c.id)}
                                  onChange={(patch) => setWField(c.id, patch)}
                                  onSubmit={() => handleWithdrawSubmit(c)}
                                  onCancel={() => setShowWithdraw(null)}
                                  submitting={submitting === c.id}
                                  fileInputRef={fileInputRef}
                                />
                              ) : (
                                <Button
                                  variant="outline"
                                  onClick={() => setShowWithdraw(c.id)}
                                  className="w-full gap-2"
                                >
                                  <ArrowRight className="w-4 h-4" />
                                  Request Withdrawal
                                </Button>
                              )}
                            </div>
                          )}

                          {c.status === 'pending_verification' && (
                            <GetVerifiedPanel
                              campaign={c}
                              orgs={matchingOrgs[c.id]}
                              sentRequests={sentRequests[c.id] ?? new Set()}
                              verifyNote={verifyNotes}
                              onNoteChange={(orgId, note) =>
                                setVerifyNotes((prev) => ({
                                  ...prev,
                                  [`${c.id}-${orgId}`]: note,
                                }))
                              }
                              onLoadOrgs={() => loadMatchingOrgs(c)}
                              onRequest={(orgId) => handleRequestVerification(c, orgId)}
                              requesting={requestingVerify}
                            />
                          )}

                          {c.status === 'pending_review' && (
                            <Alert className="border-warning bg-warning/10">
                              <AlertCircle className="w-4 h-4" />
                              <AlertDescription className="text-sm">
                                Your campaign has a low AI trust score and is under admin review.
                                We'll evaluate it and may contact you for additional information.
                              </AlertDescription>
                            </Alert>
                          )}

                          {c.status === 'needs_more_proof' && (
                            <NeedsMoreProofPanel
                              campaign={c}
                              files={resubmitFiles[c.id] ?? []}
                              onFilesChange={(files) =>
                                setResubmitFiles((prev) => ({ ...prev, [c.id]: files }))
                              }
                              onResubmit={() => handleResubmit(c)}
                              submitting={resubmitting === c.id}
                              fileInputRef={resubmitFileRef}
                            />
                          )}
                        </>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// ─── Withdrawal form sub-component ───────────────────────────────────────────

interface WFormProps {
  campaign:     DbCampaign;
  milestones:   DbMilestone[];
  nextMilestone?: DbMilestone;
  form:         { milestoneId: string; amount: string; description: string; proofFile: File | null };
  onChange:     (patch: any) => void;
  onSubmit:     () => void;
  onCancel:     () => void;
  submitting:   boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

// ─── Get Verified panel ──────────────────────────────────────────────────────

interface GetVerifiedPanelProps {
  campaign:       DbCampaign;
  orgs?:          DbOrganization[];
  sentRequests:   Set<string>;
  verifyNote:     Record<string, string>;
  onNoteChange:   (orgId: string, note: string) => void;
  onLoadOrgs:     () => void;
  onRequest:      (orgId: string) => void;
  requesting:     string | null;
}

function GetVerifiedPanel({
  campaign, orgs, sentRequests, verifyNote, onNoteChange, onLoadOrgs, onRequest, requesting,
}: GetVerifiedPanelProps) {
  const [panelOpen, setPanelOpen] = useState(false);

  const handleExpand = () => {
    if (!panelOpen) onLoadOrgs();
    setPanelOpen((v) => !v);
  };

  return (
    <div className="border border-warning/40 rounded-lg bg-warning/5 overflow-hidden">
      <button
        type="button"
        onClick={handleExpand}
        className="w-full flex items-center justify-between p-3 text-left"
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-warning" />
          <div>
            <p className="text-sm font-medium">Awaiting trusted verifier endorsement</p>
            <p className="text-xs text-muted-foreground">
              Request verification from a registered organization to go live
            </p>
          </div>
        </div>
        {panelOpen
          ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {panelOpen && (
        <div className="border-t px-3 pb-3 space-y-3">
          {!orgs ? (
            <div className="flex justify-center py-4">
              <Loader className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : orgs.length === 0 ? (
            <div className="py-3 text-center">
              <p className="text-xs text-muted-foreground">
                No registered organizations for <span className="font-medium capitalize">{campaign.category}</span> campaigns yet.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Share the{' '}
                <Link href="/register/organization" className="text-primary hover:underline">
                  organization registration link
                </Link>{' '}
                with a hospital, NGO, or similar institution.
              </p>
            </div>
          ) : (
            <div className="space-y-2 pt-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {campaign.category} verifiers
              </p>
              {orgs.map((org) => {
                const sent    = sentRequests.has(org.id);
                const noteKey = `${campaign.id}-${org.id}`;
                return (
                  <div key={org.id} className="border rounded-lg p-2.5 space-y-2 bg-background">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium">{org.org_name}</span>
                          <Badge variant="outline" className="text-xs">Tier {org.tier}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                          {org.org_type.replace(/_/g, ' ')} · {org.geographic_scope}
                        </p>
                      </div>
                      {sent ? (
                        <Badge className="bg-success text-success-foreground text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" /> Requested
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-xs h-7"
                          disabled={requesting === org.id}
                          onClick={() => onRequest(org.id)}
                        >
                          {requesting === org.id
                            ? <Loader className="w-3 h-3 animate-spin" />
                            : <Send className="w-3 h-3" />}
                          Request
                        </Button>
                      )}
                    </div>
                    {!sent && (
                      <input
                        type="text"
                        className="w-full px-2 py-1 text-xs border rounded-md bg-muted/30"
                        placeholder="Optional: explain your connection to this organization"
                        value={verifyNote[noteKey] ?? ''}
                        onChange={(e) => onNoteChange(org.id, e.target.value)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Needs More Proof panel ───────────────────────────────────────────────────

interface NeedsMoreProofPanelProps {
  campaign:       DbCampaign;
  files:          File[];
  onFilesChange:  (files: File[]) => void;
  onResubmit:     () => void;
  submitting:     boolean;
  fileInputRef:   React.RefObject<HTMLInputElement | null>;
}

function NeedsMoreProofPanel({
  campaign, files, onFilesChange, onResubmit, submitting, fileInputRef,
}: NeedsMoreProofPanelProps) {
  const flags      = campaign.ai_document_flags ?? campaign.ai_flags ?? [];
  const docScore   = campaign.ai_document_score ?? 0;
  const trustScore = campaign.ai_trust_score ?? 0;
  const version    = campaign.analysis_version ?? 1;
  const attemptsLeft = 3 - version;

  const flagLabels: Record<string, string> = {
    no_documents_uploaded:    'No documents were uploaded',
    description_too_short:    'Campaign description is too short',
    no_readable_documents:    'Uploaded documents could not be read (try clearer scans)',
    document_dated_in_future: 'A document appears to be dated in the future',
    timeline_mismatch_major:  'Document dates don\'t match the timeline described',
    contradiction_patient_name:    'Patient name mismatch between story and documents',
    contradiction_hospital_name:   'Hospital name mismatch between story and documents',
    contradiction_diagnosis:       'Diagnosis mismatch between story and documents',
    contradiction_doctor_name:     'Doctor name mismatch between story and documents',
    contradiction_local_currency_amount: 'Amount mentioned doesn\'t match documents',
  };

  const removeFile = (index: number) =>
    onFilesChange(files.filter((_, i) => i !== index));

  const addFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const added = Array.from(e.target.files ?? []);
    onFilesChange([...files, ...added].slice(0, 5));
    e.target.value = '';
  };

  return (
    <div className="border border-destructive/30 rounded-lg p-4 space-y-4 bg-destructive/5">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-destructive">More proof required</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            AI trust score: {trustScore}/100 · Document evidence: {docScore}/40
            {attemptsLeft > 0
              ? ` · ${attemptsLeft} re-submission${attemptsLeft !== 1 ? 's' : ''} remaining`
              : ' · No re-submissions left — contact admin'}
          </p>
        </div>
      </div>

      {flags.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Issues to address
          </p>
          <ul className="space-y-1">
            {flags.map((flag) => (
              <li key={flag} className="flex items-center gap-2 text-xs text-destructive">
                <span className="w-1 h-1 rounded-full bg-destructive inline-block shrink-0" />
                {flagLabels[flag] ?? flag.replace(/_/g, ' ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-xs font-medium">Upload supporting documents</p>
        <p className="text-xs text-muted-foreground">
          Add medical records, invoices, registration certificates, or any document that
          corroborates your campaign story. Clear photos or scans work best. Max 5 files.
        </p>

        {files.length > 0 && (
          <div className="space-y-1.5">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-2 p-2 bg-muted/50 rounded text-xs">
                <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="truncate flex-1">{f.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          onChange={addFiles}
        />

        {files.length < 5 && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 p-3 border border-dashed rounded-lg text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            {files.length === 0 ? 'Add documents' : 'Add more documents'}
          </button>
        )}
      </div>

      {attemptsLeft > 0 && (
        <Button
          onClick={onResubmit}
          disabled={submitting || files.length === 0}
          className="w-full gap-2"
          variant="default"
        >
          {submitting ? (
            <><Loader className="w-4 h-4 animate-spin" /> Analyzing…</>
          ) : (
            <><RefreshCw className="w-4 h-4" /> Re-Analyze Campaign</>
          )}
        </Button>
      )}
    </div>
  );
}

// ─── Withdrawal form sub-component ───────────────────────────────────────────

function WithdrawForm({ campaign, milestones, nextMilestone, form, onChange, onSubmit, onCancel, submitting, fileInputRef }: WFormProps) {
  return (
    <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
      <p className="text-sm font-medium">Withdrawal Request</p>

      {nextMilestone && (
        <div className="flex items-center gap-2 p-2.5 bg-muted/50 rounded text-sm">
          <CheckCircle className="w-3.5 h-3.5 text-success flex-shrink-0" />
          <span className="text-muted-foreground">Milestone:</span>
          <span className="font-medium">{nextMilestone.title}</span>
          <span className="text-muted-foreground ml-auto">{nextMilestone.target_amount_eth} ETH</span>
        </div>
      )}

      <div className="space-y-1">
        <Label>Amount (ETH)</Label>
        <Input
          type="number"
          step="0.001"
          min="0.001"
          value={form.amount}
          onChange={(e) => onChange({ amount: e.target.value })}
          placeholder="e.g., 0.5"
        />
      </div>

      <div className="space-y-1">
        <Label>What was accomplished?</Label>
        <Textarea
          placeholder="Describe what was completed, what the funds were used for, and what proof you are uploading."
          value={form.description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={3}
        />
      </div>

      <div className="space-y-1">
        <Label>Proof Document *</Label>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          onChange={(e) => onChange({ proofFile: e.target.files?.[0] ?? null })}
        />
        {form.proofFile ? (
          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm truncate">{form.proofFile.name}</span>
            <Button variant="ghost" size="sm" onClick={() => onChange({ proofFile: null })}>
              Remove
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-2 p-3 border border-dashed rounded-lg text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload invoice, receipt, or photo proof
          </button>
        )}
      </div>

      <div className="flex gap-3">
        <Button
          onClick={onSubmit}
          disabled={submitting}
          className="flex-1 gap-2"
        >
          {submitting ? (
            <><Loader className="w-4 h-4 animate-spin" /> Submitting…</>
          ) : (
            <><CheckCircle className="w-4 h-4" /> Submit Request</>
          )}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

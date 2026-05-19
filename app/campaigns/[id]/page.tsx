'use client';

import { useEffect, useState } from 'react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Shield, CheckCircle, ExternalLink, Wallet, AlertCircle,
  Loader, ShieldCheck, Building2, FileText, Clock,
} from 'lucide-react';
import { useWeb3 } from '@/lib/web3-context';
import { toast } from 'sonner';
import { ethers } from 'ethers';
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

  const [data, setData]         = useState<CampaignDetail | null>(null);
  const [onChainRaised, setOnChainRaised] = useState<number | null>(null);
  const [loading, setLoading]   = useState(true);
  const [donating, setDonating] = useState(false);
  const [amount, setAmount]     = useState('');

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

  // Donate
  const handleDonate = async () => {
    if (!isConnected || !contract) {
      toast.error('Connect your wallet first');
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
    try {
      toast.loading('Confirm in MetaMask…');
      const amountWei = ethers.parseEther(amount);
      const tx        = await contract.donate(data.campaign.contract_id, { value: amountWei });

      toast.loading('Waiting for confirmation…');
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

      toast.success('Donation confirmed!');
      setAmount('');

      // Refresh data
      const res = await fetch(`/api/campaigns/${campaignId}`);
      if (res.ok) setData(await res.json());

      // Refresh on-chain amount
      const updated = await contract.getCampaign(data.campaign.contract_id);
      setOnChainRaised(Number(ethers.formatEther(updated.amountRaised)));
    } catch (err) {
      console.error(err);
      toast.error('Donation failed');
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
  const isCreator     = account?.toLowerCase() === campaign.creator_wallet.toLowerCase();
  const canDonate     = campaign.status === 'active' || campaign.status === 'funded';
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

              {/* Verifier endorsements */}
              {endorsements.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Verified By
                  </h2>
                  {endorsements.map((e) => (
                    <div key={e.id} className="flex items-start gap-3 p-3 bg-success/10 rounded-lg border border-success/30">
                      <ShieldCheck className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{e.verifier_org_name}</span>
                        </div>
                        {e.endorsement_note && (
                          <p className="text-sm text-muted-foreground mt-1">{e.endorsement_note}</p>
                        )}
                        {e.corroborating_doc_ipfs && (
                          <a
                            href={`https://gateway.pinata.cloud/ipfs/${e.corroborating_doc_ipfs}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary mt-1 hover:underline"
                          >
                            <FileText className="w-3 h-3" /> View endorsement document
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* AI explanation */}
              {campaign.ai_explanation && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="w-4 h-4 text-primary" />
                      AI Verification Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {campaign.ai_explanation}
                    </p>
                    {campaign.ai_flags && (campaign.ai_flags as string[]).length > 0 && (
                      <div className="mt-3 space-y-1">
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
                    milestones.map((m, i) => (
                      <Card key={m.id} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-sm font-medium flex-shrink-0">
                              {i + 1}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{m.title}</p>
                              <p className="text-sm text-muted-foreground mt-0.5">{m.description}</p>
                              <p className="text-sm font-medium mt-1">{m.target_amount_eth} ETH</p>
                            </div>
                          </div>
                          <Badge className={milestoneStatusClass(m.status)} variant="secondary">
                            {m.status.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                      </Card>
                    ))
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

                  {/* Donation input */}
                  {canDonate && (
                    <>
                      {!isConnected && (
                        <Alert className="border-warning bg-warning/10">
                          <AlertCircle className="w-4 h-4" />
                          <AlertDescription className="text-sm">
                            Connect your wallet to donate.
                          </AlertDescription>
                        </Alert>
                      )}

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
                        disabled={!isConnected || donating || !amount}
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

                  {pct >= 100 && (
                    <Alert className="bg-success/10 border-success">
                      <CheckCircle className="w-4 h-4" />
                      <AlertDescription>This campaign has reached its goal!</AlertDescription>
                    </Alert>
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
            </div>

          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

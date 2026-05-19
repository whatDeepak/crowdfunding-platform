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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWeb3 } from '@/lib/web3-context';
import { toast } from 'sonner';
import { ethers } from 'ethers';
import {
  Loader, Plus, ArrowRight, AlertCircle, FileText,
  Upload, CheckCircle, ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react';
import type { DbCampaign, DbMilestone, DbWithdrawalRequest } from '@/lib/types';

interface CampaignDetail {
  campaign:  DbCampaign;
  milestones: DbMilestone[];
  withdrawals: DbWithdrawalRequest[];
}

function statusBadgeClass(status: string) {
  if (status === 'active' || status === 'funded') return 'bg-success text-success-foreground';
  if (status.startsWith('pending_')) return 'bg-warning text-warning-foreground';
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
    try {
      // 1. Upload proof to IPFS
      toast.loading('Uploading proof document…');
      const proofCid = await uploadFile(f.proofFile);

      // 2. Submit on-chain (if contract_id is set)
      let contractRequestId: number | null = null;
      if (contract && campaign.contract_id != null) {
        toast.loading('Confirm transaction in MetaMask…');
        const amountWei = ethers.parseEther(f.amount);
        const tx = await contract.submitWithdrawalRequest(
          campaign.contract_id,
          amountWei,
          proofCid
        );
        toast.loading('Waiting for confirmation…');
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
      toast.loading('Saving withdrawal request…');
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

      toast.success('Withdrawal request submitted for admin review!');
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
      toast.error(err?.shortMessage ?? err?.message ?? 'Submission failed');
    } finally {
      setSubmitting(null);
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
              const canWithdraw = (c.status === 'active' || c.status === 'funded') && c.contract_id != null;

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
                          {/* Milestones */}
                          {detail.milestones.length > 0 && (
                            <div>
                              <p className="text-sm font-medium mb-2">Milestones</p>
                              <div className="space-y-2">
                                {detail.milestones.map((m, i) => (
                                  <div
                                    key={m.id}
                                    className="flex items-center justify-between p-2.5 bg-muted/40 rounded-lg text-sm"
                                  >
                                    <span className="font-medium">{i + 1}. {m.title}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-muted-foreground">{m.target_amount_eth} ETH</span>
                                      <Badge className="text-xs" variant="outline">
                                        {m.status.replace(/_/g, ' ')}
                                      </Badge>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Past withdrawals */}
                          {detail.withdrawals.length > 0 && (
                            <div>
                              <p className="text-sm font-medium mb-2">Withdrawal Requests</p>
                              <div className="space-y-2">
                                {detail.withdrawals.map((w) => (
                                  <div
                                    key={w.id}
                                    className="flex items-center justify-between p-2.5 border rounded-lg text-sm"
                                  >
                                    <span>{w.proof_description?.slice(0, 40) ?? 'Request'}…</span>
                                    <div className="flex items-center gap-2">
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
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Withdrawal request button */}
                          {canWithdraw && (
                            <div>
                              {showWithdraw === c.id ? (
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
                                  Request Milestone Withdrawal
                                </Button>
                              )}
                            </div>
                          )}

                          {c.status === 'pending_verification' && (
                            <Alert className="border-warning bg-warning/10">
                              <AlertCircle className="w-4 h-4" />
                              <AlertDescription className="text-sm">
                                Your campaign is awaiting endorsement from a trusted verifier
                                (hospital, NGO, etc.). Once endorsed it will go live automatically.
                              </AlertDescription>
                            </Alert>
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
  campaign:    DbCampaign;
  milestones:  DbMilestone[];
  form:        { milestoneId: string; amount: string; description: string; proofFile: File | null };
  onChange:    (patch: any) => void;
  onSubmit:    () => void;
  onCancel:    () => void;
  submitting:  boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

function WithdrawForm({ campaign, milestones, form, onChange, onSubmit, onCancel, submitting, fileInputRef }: WFormProps) {
  const pendingMilestones = milestones.filter((m) => m.status === 'pending');

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
      <p className="text-sm font-medium">Withdrawal Request</p>

      {pendingMilestones.length > 0 && (
        <div className="space-y-1">
          <Label>Milestone (optional)</Label>
          <Select
            value={form.milestoneId}
            onValueChange={(v) => {
              const m = milestones.find((ms) => ms.id === v);
              onChange({ milestoneId: v, amount: m ? m.target_amount_eth.toString() : form.amount });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select milestone" />
            </SelectTrigger>
            <SelectContent>
              {pendingMilestones.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.title} ({m.target_amount_eth} ETH)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

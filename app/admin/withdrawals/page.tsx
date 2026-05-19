'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useWeb3 } from '@/lib/web3-context';
import { toast } from 'sonner';
import {
  Loader, AlertCircle, CheckCircle, XCircle,
  FileText, Shield, ExternalLink, ChevronDown, ChevronUp,
} from 'lucide-react';
import type { DbWithdrawalRequest } from '@/lib/types';

interface WithdrawalWithCampaign extends DbWithdrawalRequest {
  campaign_title?: string;
  campaign_category?: string;
  contract_id?: number;
}

export default function AdminWithdrawalsPage() {
  const { isAdmin, isConnected, connectWallet, contract, account } = useWeb3();

  const [requests, setRequests]   = useState<WithdrawalWithCampaign[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [reasons, setReasons]     = useState<Record<string, string>>({});
  const [acting, setActing]       = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    fetch('/api/withdrawal-requests?pending=true')
      .then((r) => r.ok ? r.json() : [])
      .then(setRequests)
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  const handleApprove = async (req: WithdrawalWithCampaign) => {
    if (!contract || !account) return;
    if (!req.contract_request_id || !req.contract_id) {
      toast.error('Missing on-chain IDs — cannot approve');
      return;
    }

    setActing(req.id);
    try {
      toast.loading('Confirm transaction in MetaMask…');
      const tx = await contract.approveWithdrawal(req.contract_id, req.contract_request_id);
      toast.loading('Waiting for confirmation…');
      const receipt = await tx.wait();

      // Record in DB
      const res = await fetch('/api/admin/approve-withdrawal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          withdrawalId: req.id,
          campaignId:   req.campaign_id,
          txHash:       receipt.hash,
          adminWallet:  account,
        }),
      });
      if (!res.ok) throw new Error('DB update failed');

      toast.success(`Withdrawal approved — ${req.requested_amount_eth} ETH released`);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
    } catch (err: any) {
      console.error(err);
      toast.error(err?.shortMessage ?? err?.message ?? 'Transaction failed');
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (req: WithdrawalWithCampaign) => {
    const reason = reasons[req.id]?.trim();
    if (!reason) { toast.error('Enter a rejection reason'); return; }
    if (!account) return;

    setActing(req.id);
    try {
      if (contract && req.contract_id != null && req.contract_request_id != null) {
        toast.loading('Confirm rejection on chain…');
        const tx = await contract.rejectWithdrawal(
          req.contract_id,
          req.contract_request_id,
          reason
        );
        await tx.wait();
      }

      const res = await fetch('/api/admin/reject-withdrawal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          withdrawalId: req.id,
          campaignId:   req.campaign_id,
          reason,
          adminWallet:  account,
        }),
      });
      if (!res.ok) throw new Error('DB update failed');

      toast.success('Withdrawal rejected');
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
    } catch (err: any) {
      console.error(err);
      toast.error(err?.shortMessage ?? err?.message ?? 'Action failed');
    } finally {
      setActing(null);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Button onClick={connectWallet}>Connect Admin Wallet</Button>
        </main>
        <Footer />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
            <p className="font-medium">Admin wallet required</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="bg-gradient-to-b from-muted/50 to-background py-10">
          <div className="container mx-auto px-4 flex items-center gap-4">
            <Link href="/admin" className="text-muted-foreground hover:text-foreground text-sm">
              ← Admin
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Withdrawal Approvals</h1>
              <p className="text-muted-foreground">
                Review proof documents and release ETH via on-chain transaction
              </p>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <Alert className="mb-6">
            <Shield className="w-4 h-4" />
            <AlertDescription>
              Approving releases ETH directly from the smart contract to the creator's wallet.
              Rejection is recorded both on-chain and off-chain. Every action is permanent.
            </AlertDescription>
          </Alert>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-20">
              <CheckCircle className="w-10 h-10 text-success mx-auto mb-3" />
              <p className="text-lg font-medium">No pending withdrawal requests</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((req) => {
                const isOpen = expanded === req.id;
                const isBusy = acting === req.id;

                return (
                  <Card key={req.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap gap-2 mb-1.5">
                            <Badge variant="outline">{req.requested_amount_eth} ETH</Badge>
                            {req.ai_recommendation && (
                              <Badge className={
                                req.ai_recommendation === 'approve'
                                  ? 'bg-success text-success-foreground'
                                  : req.ai_recommendation === 'flag'
                                  ? 'bg-warning text-warning-foreground'
                                  : 'bg-destructive text-destructive-foreground'
                              }>
                                AI: {req.ai_recommendation}
                              </Badge>
                            )}
                            {req.ai_consistency_score != null && (
                              <Badge variant="secondary">
                                Consistency: {req.ai_consistency_score}%
                              </Badge>
                            )}
                          </div>
                          <CardTitle className="text-base">
                            {req.proof_description ?? 'Withdrawal request'}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground mt-1">
                            Campaign {req.campaign_id.slice(0, 8)}… •{' '}
                            {new Date(req.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpanded(isOpen ? null : req.id)}
                        >
                          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      </div>
                    </CardHeader>

                    {isOpen && (
                      <CardContent className="space-y-5 pt-0">
                        {/* AI admin note */}
                        {req.ai_admin_note && (
                          <div className="p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <Shield className="w-4 h-4 text-primary" />
                              <p className="text-xs font-medium">AI Review Note</p>
                            </div>
                            <p className="text-sm text-muted-foreground">{req.ai_admin_note}</p>
                          </div>
                        )}

                        {/* Proof document */}
                        {req.proof_ipfs_hash && (
                          <div className="flex items-center gap-3 p-3 border rounded-lg">
                            <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">Proof Document</p>
                              <p className="text-xs text-muted-foreground">{req.proof_ipfs_hash.slice(0, 20)}…</p>
                            </div>
                            <a
                              href={`https://gateway.pinata.cloud/ipfs/${req.proof_ipfs_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-sm text-primary hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" /> View
                            </a>
                          </div>
                        )}

                        <a
                          href={`/campaigns/${req.campaign_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" /> View campaign
                        </a>

                        {/* Actions */}
                        <div className="border-t pt-4 space-y-3">
                          <Textarea
                            placeholder="Rejection reason (required for rejection)"
                            value={reasons[req.id] ?? ''}
                            onChange={(e) => setReasons((prev) => ({ ...prev, [req.id]: e.target.value }))}
                            rows={2}
                          />
                          <div className="flex gap-3">
                            <Button
                              onClick={() => handleApprove(req)}
                              disabled={isBusy}
                              className="flex-1 gap-2 bg-success hover:bg-success/90"
                            >
                              {isBusy ? (
                                <Loader className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                              Approve & Release ETH
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={() => handleReject(req)}
                              disabled={isBusy}
                              className="flex-1 gap-2"
                            >
                              {isBusy ? (
                                <Loader className="w-4 h-4 animate-spin" />
                              ) : (
                                <XCircle className="w-4 h-4" />
                              )}
                              Reject
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

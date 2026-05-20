'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { parseContractError } from '@/lib/utils';
import { useWeb3 } from '@/lib/web3-context';
import {
  Wallet, TrendingUp, Activity, ArrowRight, AlertCircle,
  Loader, ExternalLink, Plus, RefreshCcw,
} from 'lucide-react';
import type { DbCampaign, DbDonation } from '@/lib/types';

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active:               'bg-success text-success-foreground',
    funded:               'bg-success text-success-foreground',
    pending_ai:           'bg-muted text-muted-foreground',
    pending_verification: 'bg-warning text-warning-foreground',
    pending_review:       'bg-warning text-warning-foreground',
    completed:            'bg-primary text-primary-foreground',
    cancelled:            'bg-destructive text-destructive-foreground',
    rejected:             'bg-destructive text-destructive-foreground',
  };
  const cls = map[status] ?? 'bg-muted text-muted-foreground';
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return <Badge className={cls}>{label}</Badge>;
}

export default function DashboardPage() {
  const { account, isConnected, connectWallet, contract } = useWeb3();
  const [campaigns, setCampaigns]   = useState<DbCampaign[]>([]);
  const [donations, setDonations]   = useState<DbDonation[]>([]);
  const [loading, setLoading]       = useState(false);
  const [refunding, setRefunding]   = useState<string | null>(null);

  useEffect(() => {
    if (!account) return;

    setLoading(true);
    Promise.all([
      fetch(`/api/campaigns?creator=${account}`).then((r) => r.ok ? r.json() : []),
      fetch(`/api/donations?donor=${account}`).then((r) => r.ok ? r.json() : []),
    ]).then(([cData, dData]) => {
      setCampaigns(Array.isArray(cData) ? cData : []);
      setDonations(Array.isArray(dData) ? dData : []);
    }).finally(() => setLoading(false));
  }, [account]);

  if (!isConnected) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Wallet className="w-12 h-12 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
          <p className="text-muted-foreground mb-6">Connect MetaMask to view your dashboard.</p>
          <Button onClick={connectWallet}>Connect MetaMask</Button>
        </div>
      </DashboardLayout>
    );
  }

  const handleClaimRefund = async (donation: DbDonation) => {
    if (!contract) { toast.error('Connect MetaMask first'); return; }
    const contractId = donation.campaigns?.contract_id;
    if (contractId == null) { toast.error('No on-chain record for this campaign'); return; }

    setRefunding(donation.id);
    try {
      const tx = await contract.claimRefund(contractId);
      toast.info('Refund submitted — waiting for confirmation…');
      const receipt = await tx.wait();
      toast.success(`Refund confirmed! Tx: ${receipt.hash.slice(0, 10)}…`);
      // Mark donation as refunded in local state
      setDonations((prev) =>
        prev.map((d) => d.id === donation.id ? { ...d, status: 'refunded' as any } : d)
      );
    } catch (err: any) {
      toast.error(parseContractError(err));
    } finally {
      setRefunding(null);
    }
  };

  const totalDonatedEth = donations
    .filter((d) => d.status === 'confirmed')
    .reduce((s, d) => s + d.amount_eth, 0);
  const activeCampaigns = campaigns.filter((c) => c.status === 'active' || c.status === 'funded');
  const refundableDonations = donations.filter(
    (d) => d.campaigns?.status === 'cancelled' && d.status === 'confirmed'
  );

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-1">Dashboard</h1>
            <p className="text-muted-foreground text-sm">
              {account?.slice(0, 6)}…{account?.slice(-4)}
            </p>
          </div>
          <Button asChild>
            <Link href="/create-campaign">
              <Plus className="mr-2 h-4 w-4" /> New Campaign
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Donated</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalDonatedEth.toFixed(3)} ETH</div>
              <p className="text-xs text-muted-foreground mt-1">Across {donations.length} transactions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-muted-foreground">Active Campaigns</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeCampaigns.length}</div>
              <p className="text-xs text-muted-foreground mt-1">{campaigns.length} total created</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-muted-foreground">Campaigns Supported</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Set(donations.map((d) => d.campaign_id)).size}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Unique campaigns</p>
            </CardContent>
          </Card>
        </div>

        {loading && (
          <div className="flex justify-center py-10">
            <Loader className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* My Campaigns */}
        {!loading && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>My Campaigns</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/my-campaigns">View all</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {campaigns.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">You haven't created any campaigns yet.</p>
                  <Button asChild>
                    <Link href="/create-campaign">Create Your First Campaign</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {campaigns.slice(0, 5).map((c) => {
                    const pct = c.target_amount_eth > 0
                      ? Math.min((c.current_amount_eth / c.target_amount_eth) * 100, 100)
                      : 0;
                    return (
                      <div key={c.id} className="flex items-center justify-between py-3 border-b last:border-0 gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{c.title}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <Progress value={pct} className="h-1.5 w-24" />
                            <span className="text-xs text-muted-foreground">
                              {c.current_amount_eth.toFixed(3)} / {c.target_amount_eth.toFixed(2)} ETH
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {statusBadge(c.status)}
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/campaigns/${c.id}`}>
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recent Donations */}
        {!loading && donations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Donations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {donations.slice(0, 5).map((d) => (
                  <div key={d.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">{d.campaign_id.slice(0, 8)}…</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(d.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{d.amount_eth.toFixed(4)} ETH</span>
                      {d.transaction_hash && (
                        <a
                          href={`https://sepolia.etherscan.io/tx/${d.transaction_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Refundable Donations */}
        {!loading && refundableDonations.length > 0 && (
          <Card className="border-warning">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCcw className="w-5 h-5 text-warning" />
                Refunds Available
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                The following campaigns were cancelled. You can reclaim your ETH directly from the escrow contract.
              </p>
              <div className="space-y-3">
                {refundableDonations.map((d) => (
                  <div key={d.id} className="flex items-center justify-between py-2 border-b last:border-0 gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {d.campaigns?.title ?? d.campaign_id.slice(0, 8) + '…'}
                      </p>
                      <p className="text-xs text-muted-foreground">{d.amount_eth.toFixed(4)} ETH donated</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-warning text-warning hover:bg-warning/10 flex-shrink-0"
                      disabled={refunding === d.id}
                      onClick={() => handleClaimRefund(d)}
                    >
                      {refunding === d.id ? (
                        <Loader className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCcw className="w-3.5 h-3.5" />
                      )}
                      Claim Refund
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending campaigns notice */}
        {campaigns.some((c) => c.status === 'pending_verification' || c.status === 'pending_review') && (
          <Alert className="border-warning bg-warning/10">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              You have campaigns awaiting verification. A trusted organization or admin will review them.
              Check the campaign page for details.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </DashboardLayout>
  );
}

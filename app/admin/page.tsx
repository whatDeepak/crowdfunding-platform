'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ethers } from 'ethers';
import { toast } from 'sonner';
import { parseContractError } from '@/lib/utils';
import { useWeb3 } from '@/lib/web3-context';
import { useAuth } from '@/lib/auth-context';
import { ShieldCheck, Clock, ArrowRight, AlertCircle, Loader, FileText, Building2, Coins } from 'lucide-react';

export default function AdminPage() {
  const { isConnected, account, contract } = useWeb3();
  const { isAdmin, user } = useAuth();
  const [stats, setStats]   = useState({ pendingCampaigns: 0, pendingWithdrawals: 0, pendingOrgs: 0 });
  const [loading, setLoading] = useState(false);
  const [platformFees, setPlatformFees] = useState<string | null>(null);
  const [claimingFees, setClaimingFees] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;

    setLoading(true);
    Promise.all([
      fetch('/api/admin/campaigns').then((r) => r.ok ? r.json() : []),
      fetch('/api/withdrawal-requests?pending=true').then((r) => r.ok ? r.json() : []),
      fetch('/api/organizations?status=pending_approval&per_page=50').then((r) => r.ok ? r.json() : { orgs: [] }),
    ]).then(([camps, withdrawals, orgsData]) => {
      const orgsArr = Array.isArray(orgsData) ? orgsData : (orgsData?.orgs ?? []);
      setStats({
        pendingCampaigns:   Array.isArray(camps)       ? camps.length       : 0,
        pendingWithdrawals: Array.isArray(withdrawals) ? withdrawals.length : 0,
        pendingOrgs:        orgsArr.length,
      });
    }).finally(() => setLoading(false));
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || !contract) return;
    contract.platformFeesCollected().then((raw: bigint) => {
      setPlatformFees(ethers.formatEther(raw));
    }).catch(() => {});
  }, [isAdmin, contract]);

  const handleClaimFees = async () => {
    if (!contract) { toast.error('Connect MetaMask first'); return; }
    setClaimingFees(true);
    try {
      const tx = await contract.withdrawPlatformFees();
      toast.info('Transaction submitted — waiting for confirmation…');
      await tx.wait();
      toast.success('Platform fees withdrawn to admin wallet');
      // Refresh balance
      contract.platformFeesCollected().then((raw: bigint) => {
        const { ethers } = require('ethers');
        setPlatformFees(ethers.formatEther(raw));
      }).catch(() => {});
    } catch (err: any) {
      toast.error(parseContractError(err));
    } finally {
      setClaimingFees(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Admin Access</h1>
            <p className="text-muted-foreground mb-6">Sign in to access the admin panel.</p>
            <Button asChild><Link href="/login?next=/admin">Sign In</Link></Button>
          </div>
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
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Unauthorized</h1>
            <p className="text-muted-foreground">
              Connected wallet is not the admin wallet.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-10 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-1">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">{account}</p>
        </div>

        <Alert className="mb-8 bg-primary/10 border-primary">
          <ShieldCheck className="w-4 h-4" />
          <AlertDescription>
            Fund releases are signed directly via MetaMask — your private key never leaves your browser.
            Every approval is permanently recorded on Sepolia Etherscan.
          </AlertDescription>
        </Alert>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-warning" />
                  Campaign Review Queue
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-4xl font-bold text-warning">{stats.pendingCampaigns}</div>
                <p className="text-sm text-muted-foreground">
                  Campaigns with low AI trust score (&lt;40) awaiting manual review.
                </p>
                <Button asChild className="w-full gap-2">
                  <Link href="/admin/campaigns">
                    Review Campaigns <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  Withdrawal Approvals
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-4xl font-bold text-primary">{stats.pendingWithdrawals}</div>
                <p className="text-sm text-muted-foreground">
                  Withdrawal requests with proof documents awaiting on-chain approval.
                </p>
                <Button asChild className="w-full gap-2">
                  <Link href="/admin/withdrawals">
                    Review Withdrawals <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card className="hover:shadow-md transition-shadow mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-muted-foreground" />
                Organization Applications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-4xl font-bold">{stats.pendingOrgs}</div>
              <p className="text-sm text-muted-foreground">
                Trusted verifier registrations awaiting admin approval.
              </p>
              <Button asChild variant="outline" className="w-full gap-2">
                <Link href="/admin/organizations">
                  Review Applications <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-success" />
                Platform Revenue
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-4xl font-bold text-success">
                {platformFees != null ? `${parseFloat(platformFees).toFixed(4)} ETH` : '—'}
              </div>
              <p className="text-sm text-muted-foreground">
                2% platform fee collected from approved withdrawals, held in the escrow contract.
              </p>
              <Button
                className="w-full gap-2"
                variant="outline"
                disabled={claimingFees || !contract || platformFees === '0.0'}
                onClick={handleClaimFees}
              >
                {claimingFees ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Coins className="w-4 h-4" />
                )}
                Withdraw Fees via MetaMask
              </Button>
            </CardContent>
          </Card>

          <div className="mt-6 text-center">
            <Button asChild variant="outline" className="gap-2">
              <Link href="/admin/audit-log">
                <FileText className="w-4 h-4" /> View Audit Log
              </Link>
            </Button>
          </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

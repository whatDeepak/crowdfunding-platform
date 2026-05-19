'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useWeb3 } from '@/lib/web3-context';
import { Loader, ExternalLink, Heart } from 'lucide-react';
import type { DbDonation } from '@/lib/types';

export default function DonationsPage() {
  const { account, isConnected, connectWallet } = useWeb3();
  const [donations, setDonations] = useState<DbDonation[]>([]);
  const [loading, setLoading]     = useState(false);

  useEffect(() => {
    if (!account) return;
    setLoading(true);
    fetch(`/api/donations?donor=${account}`)
      .then((r) => r.ok ? r.json() : [])
      .then(setDonations)
      .finally(() => setLoading(false));
  }, [account]);

  if (!isConnected) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Button onClick={connectWallet}>Connect MetaMask</Button>
        </div>
      </DashboardLayout>
    );
  }

  const totalEth = donations
    .filter((d) => d.status === 'confirmed')
    .reduce((s, d) => s + d.amount_eth, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">My Donations</h1>
          <p className="text-muted-foreground">
            Total donated:{' '}
            <span className="font-semibold text-foreground">{totalEth.toFixed(4)} ETH</span>
            {' '}across{' '}
            <span className="font-semibold text-foreground">
              {new Set(donations.map((d) => d.campaign_id)).size}
            </span>{' '}campaigns
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : donations.length === 0 ? (
          <div className="text-center py-20">
            <Heart className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">You haven't donated to any campaigns yet.</p>
            <Button asChild>
              <Link href="/campaigns">Find a Campaign to Support</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {donations.map((d) => (
              <Card key={d.id}>
                <CardContent className="py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <Link
                      href={`/campaigns/${d.campaign_id}`}
                      className="font-medium text-sm hover:underline truncate block"
                    >
                      Campaign {d.campaign_id.slice(0, 8)}…
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(d.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="font-bold">{d.amount_eth.toFixed(4)} ETH</p>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${
                          d.status === 'confirmed' ? 'bg-success/20 text-success' :
                          d.status === 'failed'    ? 'bg-destructive/20 text-destructive' : ''
                        }`}
                      >
                        {d.status}
                      </Badge>
                    </div>
                    {d.transaction_hash && (
                      <a
                        href={`https://sepolia.etherscan.io/tx/${d.transaction_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80"
                        title="View on Etherscan"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

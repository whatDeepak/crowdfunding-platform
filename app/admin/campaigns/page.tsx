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
import { Progress } from '@/components/ui/progress';
import { useWeb3 } from '@/lib/web3-context';
import { toast } from 'sonner';
import {
  Loader, AlertCircle, CheckCircle, XCircle, Shield,
  ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react';
import type { DbCampaign } from '@/lib/types';

export default function AdminCampaignsPage() {
  const { isAdmin, isConnected, connectWallet } = useWeb3();

  const [campaigns, setCampaigns]     = useState<DbCampaign[]>([]);
  const [loading, setLoading]         = useState(true);
  const [expanded, setExpanded]       = useState<string | null>(null);
  const [reasons, setReasons]         = useState<Record<string, string>>({});
  const [acting, setActing]           = useState<string | null>(null);
  const [wallet, setWallet]           = useState<string>('');

  const { account } = useWeb3();
  useEffect(() => { if (account) setWallet(account); }, [account]);

  useEffect(() => {
    if (!isAdmin) return;

    fetch('/api/admin/campaigns?status=pending_review')
      .then((r) => r.ok ? r.json() : [])
      .then(setCampaigns)
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  const handleAction = async (campaign: DbCampaign, action: 'approve' | 'reject') => {
    const reason = reasons[campaign.id];
    if (action === 'reject' && !reason?.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    setActing(campaign.id);
    try {
      const res = await fetch('/api/admin/approve-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId:  campaign.id,
          adminWallet: wallet,
          action,
          reason: reason?.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Action failed');
      }

      toast.success(`Campaign ${action === 'approve' ? 'approved and live' : 'rejected'}`);
      setCampaigns((prev) => prev.filter((c) => c.id !== campaign.id));
    } catch (err: any) {
      toast.error(err.message);
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
              <h1 className="text-3xl font-bold">Campaign Review Queue</h1>
              <p className="text-muted-foreground">Campaigns with AI trust score below 40</p>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 max-w-3xl">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-20">
              <CheckCircle className="w-10 h-10 text-success mx-auto mb-3" />
              <p className="text-lg font-medium">No campaigns pending review</p>
            </div>
          ) : (
            <div className="space-y-4">
              {campaigns.map((c) => {
                const isOpen = expanded === c.id;
                const isBusy = acting === c.id;

                return (
                  <Card key={c.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap gap-2 mb-1.5">
                            <Badge variant="secondary" className="capitalize">{c.category}</Badge>
                            {c.ai_trust_score != null && (
                              <Badge className="bg-destructive text-destructive-foreground">
                                Trust Score: {c.ai_trust_score}
                              </Badge>
                            )}
                            {c.ai_risk_level && (
                              <Badge variant="outline" className="capitalize">
                                {c.ai_risk_level} risk
                              </Badge>
                            )}
                          </div>
                          <CardTitle className="text-lg leading-tight">{c.title}</CardTitle>
                          <p className="text-xs text-muted-foreground mt-1">
                            by {c.creator_wallet.slice(0, 8)}… • {c.target_amount_eth} ETH target
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpanded(isOpen ? null : c.id)}
                        >
                          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      </div>
                    </CardHeader>

                    {isOpen && (
                      <CardContent className="space-y-5 pt-0">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {c.description}
                        </p>

                        {/* AI analysis */}
                        {c.ai_explanation && (
                          <div className="p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Shield className="w-4 h-4 text-primary" />
                              <p className="text-xs font-medium">AI Analysis</p>
                            </div>
                            <p className="text-sm text-muted-foreground">{c.ai_explanation}</p>
                            {c.ai_flags && (c.ai_flags as string[]).length > 0 && (
                              <div className="mt-2 space-y-1">
                                {(c.ai_flags as string[]).map((f) => (
                                  <div key={f} className="flex items-center gap-1.5 text-xs text-warning">
                                    <AlertCircle className="w-3 h-3" />
                                    {f.replace(/_/g, ' ')}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        <a
                          href={`/campaigns/${c.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" /> View full campaign
                        </a>

                        {/* Actions */}
                        <div className="border-t pt-4 space-y-3">
                          <Textarea
                            placeholder="Rejection reason (required for rejection)"
                            value={reasons[c.id] ?? ''}
                            onChange={(e) => setReasons((prev) => ({ ...prev, [c.id]: e.target.value }))}
                            rows={2}
                          />
                          <div className="flex gap-3">
                            <Button
                              onClick={() => handleAction(c, 'approve')}
                              disabled={isBusy}
                              className="flex-1 gap-2 bg-success hover:bg-success/90"
                            >
                              {isBusy ? (
                                <Loader className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                              Approve
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={() => handleAction(c, 'reject')}
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

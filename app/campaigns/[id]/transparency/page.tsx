'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Loader, AlertCircle, Shield, Wallet, CheckCircle,
  XCircle, FileText, ExternalLink, Clock, PlusCircle, ShieldCheck,
} from 'lucide-react';
import type { DbCampaign, DbDonation, DbWithdrawalRequest, DbVerifierEndorsement, DbMilestone } from '@/lib/types';

interface TimelineEvent {
  id:        string;
  type:      'created' | 'donation' | 'endorsement' | 'withdrawal_requested' | 'withdrawal_approved' | 'withdrawal_rejected';
  timestamp: string;
  data:      Record<string, any>;
}

function buildTimeline(
  campaign:    DbCampaign,
  donations:   DbDonation[],
  endorsements: DbVerifierEndorsement[],
  withdrawals: DbWithdrawalRequest[],
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  events.push({
    id:        `created-${campaign.id}`,
    type:      'created',
    timestamp: campaign.created_at,
    data:      { title: campaign.title, target: campaign.target_amount_eth },
  });

  for (const d of donations) {
    if (d.status === 'confirmed') {
      events.push({ id: d.id, type: 'donation', timestamp: d.created_at, data: d });
    }
  }

  for (const e of endorsements) {
    events.push({ id: e.id, type: 'endorsement', timestamp: e.created_at, data: e });
  }

  for (const w of withdrawals) {
    events.push({ id: `req-${w.id}`, type: 'withdrawal_requested', timestamp: w.created_at, data: w });
    if (w.status === 'approved' && w.reviewed_at) {
      events.push({ id: `apr-${w.id}`, type: 'withdrawal_approved', timestamp: w.reviewed_at, data: w });
    }
    if (w.status === 'rejected' && w.reviewed_at) {
      events.push({ id: `rej-${w.id}`, type: 'withdrawal_rejected', timestamp: w.reviewed_at, data: w });
    }
  }

  return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

function EventIcon({ type }: { type: TimelineEvent['type'] }) {
  const cls = 'w-5 h-5';
  if (type === 'created')              return <PlusCircle   className={`${cls} text-primary`} />;
  if (type === 'donation')             return <Wallet       className={`${cls} text-success`} />;
  if (type === 'endorsement')          return <ShieldCheck  className={`${cls} text-success`} />;
  if (type === 'withdrawal_requested') return <Clock        className={`${cls} text-warning`} />;
  if (type === 'withdrawal_approved')  return <CheckCircle  className={`${cls} text-success`} />;
  if (type === 'withdrawal_rejected')  return <XCircle      className={`${cls} text-destructive`} />;
  return <FileText className={cls} />;
}

function EventCard({ event, sepoliaBase }: { event: TimelineEvent; sepoliaBase: string }) {
  const d = event.data;
  const ts = new Date(event.timestamp).toLocaleString();

  if (event.type === 'created') {
    return (
      <div className="flex flex-col gap-0.5">
        <p className="font-medium">Campaign Created</p>
        <p className="text-sm text-muted-foreground">
          Target: {d.target} ETH
        </p>
        <p className="text-xs text-muted-foreground">{ts}</p>
      </div>
    );
  }

  if (event.type === 'donation') {
    return (
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <p className="font-medium">{d.amount_eth} ETH donated</p>
          {d.transaction_hash && (
            <a
              href={`${sepoliaBase}/tx/${d.transaction_hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
        <p className="text-sm text-muted-foreground font-mono">
          {d.donor_wallet.slice(0, 8)}…{d.donor_wallet.slice(-4)}
        </p>
        <p className="text-xs text-muted-foreground">{ts}</p>
      </div>
    );
  }

  if (event.type === 'endorsement') {
    return (
      <div className="flex flex-col gap-0.5">
        <p className="font-medium">Endorsed by {d.verifier_org_name}</p>
        {d.endorsement_note && (
          <p className="text-sm text-muted-foreground">{d.endorsement_note}</p>
        )}
        {d.corroborating_doc_ipfs && (
          <a
            href={`https://gateway.pinata.cloud/ipfs/${d.corroborating_doc_ipfs}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <FileText className="w-3 h-3" /> View endorsement document
          </a>
        )}
        <p className="text-xs text-muted-foreground">{ts}</p>
      </div>
    );
  }

  if (event.type === 'withdrawal_requested') {
    return (
      <div className="flex flex-col gap-0.5">
        <p className="font-medium">Withdrawal requested — {d.requested_amount_eth} ETH</p>
        {d.proof_description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{d.proof_description}</p>
        )}
        {d.proof_ipfs_hash && (
          <a
            href={`https://gateway.pinata.cloud/ipfs/${d.proof_ipfs_hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <FileText className="w-3 h-3" /> View proof document (IPFS)
          </a>
        )}
        <p className="text-xs text-muted-foreground">{ts}</p>
      </div>
    );
  }

  if (event.type === 'withdrawal_approved') {
    return (
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <p className="font-medium text-success">Withdrawal approved — {d.requested_amount_eth} ETH released</p>
          {d.admin_tx_hash && (
            <a
              href={`${sepoliaBase}/tx/${d.admin_tx_hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{ts}</p>
      </div>
    );
  }

  if (event.type === 'withdrawal_rejected') {
    return (
      <div className="flex flex-col gap-0.5">
        <p className="font-medium text-destructive">Withdrawal rejected</p>
        {d.rejection_reason && (
          <p className="text-sm text-muted-foreground">Reason: {d.rejection_reason}</p>
        )}
        <p className="text-xs text-muted-foreground">{ts}</p>
      </div>
    );
  }

  return null;
}

export default function TransparencyPage() {
  const params     = useParams();
  const campaignId = params.id as string;

  const [loading, setLoading]   = useState(true);
  const [campaign, setCampaign] = useState<DbCampaign | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [milestones, setMilestones] = useState<DbMilestone[]>([]);

  const sepoliaBase = 'https://sepolia.etherscan.io';

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [detailRes, wRes] = await Promise.all([
          fetch(`/api/campaigns/${campaignId}`),
          fetch(`/api/withdrawal-requests?campaignId=${campaignId}`),
        ]);

        if (!detailRes.ok) throw new Error('Not found');
        const detail      = await detailRes.json();
        const withdrawals = wRes.ok ? await wRes.json() : [];

        if (cancelled) return;

        setCampaign(detail.campaign);
        setMilestones(detail.milestones ?? []);
        setTimeline(buildTimeline(
          detail.campaign,
          detail.donations  ?? [],
          detail.endorsements ?? [],
          Array.isArray(withdrawals) ? withdrawals : [],
        ));
      } catch {
        if (!cancelled) setCampaign(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [campaignId]);

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

  if (!campaign) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
            <h1 className="text-xl font-bold">Campaign not found</h1>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const totalReleased = timeline
    .filter((e) => e.type === 'withdrawal_approved')
    .reduce((s, e) => s + (e.data.requested_amount_eth ?? 0), 0);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="bg-gradient-to-b from-muted/50 to-background py-10">
          <div className="container mx-auto px-4 max-w-2xl">
            <div className="flex items-center gap-3 mb-2">
              <Link href={`/campaigns/${campaignId}`} className="text-muted-foreground hover:text-foreground text-sm">
                ← Back to Campaign
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="w-7 h-7 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Transparency Timeline</h1>
                <p className="text-muted-foreground text-sm">{campaign.title}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 max-w-2xl">
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <div className="text-xl font-bold">{campaign.current_amount_eth.toFixed(3)}</div>
              <div className="text-xs text-muted-foreground">ETH raised</div>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <div className="text-xl font-bold">{totalReleased.toFixed(3)}</div>
              <div className="text-xs text-muted-foreground">ETH released</div>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <div className="text-xl font-bold">
                {(campaign.current_amount_eth - totalReleased).toFixed(3)}
              </div>
              <div className="text-xs text-muted-foreground">ETH in escrow</div>
            </div>
          </div>

          {campaign.contract_id != null && (
            <Alert className="mb-6">
              <Shield className="w-4 h-4" />
              <AlertDescription className="text-sm">
                All fund releases are verified on-chain.{' '}
                <a
                  href={`${sepoliaBase}/address/${process.env.NEXT_PUBLIC_CONTRACT_ADDRESS}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  View escrow contract on Etherscan →
                </a>
              </AlertDescription>
            </Alert>
          )}

          {/* Milestone progress */}
          {milestones.length > 0 && (
            <div className="mb-8">
              <p className="text-sm font-medium mb-3">Milestone Progress</p>
              <div className="space-y-2">
                {milestones.map((m, i) => (
                  <div key={m.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
                        ${m.status === 'released' ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'}`}>
                        {m.status === 'released' ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
                      </div>
                      <span className="text-sm font-medium">{m.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{m.target_amount_eth} ETH</span>
                      <Badge variant="outline" className="text-xs capitalize">
                        {m.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div>
            <p className="text-sm font-medium mb-4">Event Timeline</p>
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-5 top-6 bottom-0 w-px bg-border" />

              <div className="space-y-6">
                {timeline.map((event) => (
                  <div key={event.id} className="flex gap-4 relative">
                    <div className="w-10 h-10 rounded-full bg-background border-2 border-border flex items-center justify-center flex-shrink-0 z-10">
                      <EventIcon type={event.type} />
                    </div>
                    <div className="flex-1 pb-2">
                      <EventCard event={event} sepoliaBase={sepoliaBase} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <Button asChild variant="outline">
              <Link href={`/campaigns/${campaignId}`}>← Back to Campaign</Link>
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

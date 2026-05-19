'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/lib/auth-context';
import { useWeb3 } from '@/lib/web3-context';
import { toast } from 'sonner';
import {
  Loader, ShieldCheck, AlertCircle, Upload, FileText,
  ChevronDown, ChevronUp, Building2, CheckCircle, ExternalLink, Inbox,
} from 'lucide-react';
import type { DbCampaign, DbOrganization, DbVerificationRequest } from '@/lib/types';

const PINATA_GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY ?? 'https://gateway.pinata.cloud/ipfs/';

interface EndorseFormState {
  note:    string;
  docFile: File | null;
  done:    boolean;
}

async function uploadFile(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/upload', { method: 'POST', body: form });
  if (!res.ok) throw new Error('Upload failed');
  return (await res.json()).cid as string;
}

function trustColor(score: number | null) {
  if (score === null || score === undefined) return 'bg-muted text-muted-foreground';
  if (score >= 70) return 'bg-success text-success-foreground';
  if (score >= 40) return 'bg-warning text-warning-foreground';
  return 'bg-destructive text-destructive-foreground';
}

export default function VerifyPage() {
  const { user, isAdmin, isVerifier, loading: authLoading } = useAuth();
  const { account } = useWeb3();

  const [org, setOrg]           = useState<DbOrganization | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [tab, setTab]           = useState<'queue' | 'requests'>('queue');

  // Browse queue
  const [campaigns, setCampaigns]   = useState<DbCampaign[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);

  // Incoming requests
  const [requests, setRequests]     = useState<DbVerificationRequest[]>([]);
  const [reqLoading, setReqLoading] = useState(false);

  const [expanded, setExpanded]     = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [forms, setForms]           = useState<Record<string, EndorseFormState>>({});

  // Load org profile
  useEffect(() => {
    if (!user) { setOrgLoading(false); return; }
    fetch('/api/organizations/my')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data && !data.error) setOrg(data); })
      .finally(() => setOrgLoading(false));
  }, [user]);

  // Load browse queue — filtered to org's domains
  useEffect(() => {
    if (!org) return;
    setQueueLoading(true);
    // Fetch one request per domain the org covers and merge
    const domainParams = org.domains.map((d) => `category=${d}`).join('&');
    fetch(`/api/verifications?queue=true${domainParams ? '&' + domainParams.split('&')[0] : ''}`)
      .then((r) => r.ok ? r.json() : [])
      .then(setCampaigns)
      .catch(() => setCampaigns([]))
      .finally(() => setQueueLoading(false));
  }, [org]);

  // Load incoming requests
  useEffect(() => {
    if (!org || tab !== 'requests') return;
    setReqLoading(true);
    fetch(`/api/verification-requests?organizationId=${org.id}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: DbVerificationRequest[]) =>
        setRequests(data.filter((r) => r.status === 'pending'))
      )
      .catch(() => setRequests([]))
      .finally(() => setReqLoading(false));
  }, [org, tab]);

  const getForm = (id: string): EndorseFormState =>
    forms[id] ?? { note: '', docFile: null, done: false };

  const updateForm = (id: string, patch: Partial<EndorseFormState>) =>
    setForms((prev) => ({ ...prev, [id]: { ...getForm(id), ...patch } }));

  const handleEndorse = async (campaign: DbCampaign) => {
    const form = getForm(campaign.id);
    if (!form.docFile) {
      toast.error('Please upload a corroborating document');
      return;
    }
    const wordCount = form.note.trim().split(/\s+/).length;
    if (!form.note.trim() || wordCount < 10) {
      toast.error('Endorsement note must be at least 10 words');
      return;
    }

    setSubmitting(campaign.id);
    try {
      toast.loading('Uploading endorsement document…');
      const docCid = await uploadFile(form.docFile);

      toast.loading('Submitting endorsement…');
      const res = await fetch('/api/verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId:           campaign.id,
          verifierWallet:       account ?? '',
          endorsementNote:      form.note.trim(),
          corroboratingDocIpfs: docCid,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Endorsement failed');

      const activated = data.campaign_activated;
      toast.success(
        activated
          ? 'Campaign endorsed and is now live!'
          : 'Endorsement recorded. Waiting for one more organization to activate the campaign.'
      );
      updateForm(campaign.id, { done: true });
      setTimeout(() => setCampaigns((prev) => prev.filter((c) => c.id !== campaign.id)), 2000);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to submit endorsement');
    } finally {
      setSubmitting(null);
    }
  };

  // ── Loading / access guards ──────────────────────────────────────────────────

  if (authLoading || orgLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader className="w-8 h-8 animate-spin text-muted-foreground" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Sign in required</h1>
            <p className="text-muted-foreground mb-6">
              Sign in with your organization account to access the verification queue.
            </p>
            <Button asChild><Link href="/login?next=/verify">Sign In</Link></Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!isVerifier && !isAdmin) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <AlertCircle className="w-12 h-12 text-warning mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Not a Registered Verifier</h1>
            <p className="text-muted-foreground mb-6">
              This page is for approved organizations (hospitals, NGOs, universities).
              Register your organization to get verification access.
            </p>
            <Button asChild>
              <Link href="/register/organization">Register Organization</Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!org || org.status !== 'active') {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">
              {org ? 'Organization Pending Approval' : 'No Organization Found'}
            </h1>
            <p className="text-muted-foreground mb-6">
              {org
                ? `Your organization "${org.org_name}" is currently ${org.status.replace(/_/g, ' ')}. You'll be able to endorse campaigns once it's approved by the admin team.`
                : 'Please register your organization first.'}
            </p>
            <Button asChild variant="outline">
              <Link href="/register/organization">
                {org ? 'View Registration Status' : 'Register Organization'}
              </Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ── Main verifier dashboard ──────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {/* Header band */}
        <div className="bg-gradient-to-b from-muted/50 to-background py-10">
          <div className="container mx-auto px-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="w-6 h-6 text-primary" />
                  <h1 className="text-2xl font-bold">{org.org_name}</h1>
                  <Badge className="bg-primary text-primary-foreground">
                    Tier {org.tier} Verifier
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {org.domains.map((d) => (
                    <Badge key={d} variant="secondary" className="capitalize">{d}</Badge>
                  ))}
                  <span className="text-xs text-muted-foreground self-center">
                    · {org.total_endorsements} endorsements · {org.campaigns_gone_live} campaigns activated
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 max-w-3xl">
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg mb-6 w-fit">
            <button
              onClick={() => setTab('queue')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                tab === 'queue'
                  ? 'bg-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Browse Queue
            </button>
            <button
              onClick={() => setTab('requests')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                tab === 'requests'
                  ? 'bg-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Incoming Requests
              {requests.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
                  {requests.length}
                </span>
              )}
            </button>
          </div>

          {/* Browse Queue tab */}
          {tab === 'queue' && (
            queueLoading ? (
              <div className="flex justify-center py-20">
                <Loader className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : campaigns.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <CheckCircle className="w-10 h-10 mx-auto mb-3 text-success" />
                <p className="text-lg font-medium">Queue is clear!</p>
                <p className="text-sm">No campaigns pending verification in your domains.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {campaigns.map((c) => (
                  <CampaignEndorseCard
                    key={c.id}
                    campaign={c}
                    isOpen={expanded === c.id}
                    onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
                    form={getForm(c.id)}
                    onFormChange={(patch) => updateForm(c.id, patch)}
                    onEndorse={() => handleEndorse(c)}
                    submitting={submitting === c.id}
                  />
                ))}
              </div>
            )
          )}

          {/* Incoming Requests tab */}
          {tab === 'requests' && (
            reqLoading ? (
              <div className="flex justify-center py-20">
                <Loader className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <Inbox className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No pending verification requests from campaign creators.</p>
                <p className="text-sm mt-1">Browse the queue to proactively endorse campaigns.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((req) => (
                  <Card key={req.id} className="border-primary/30">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium mb-1">
                            Verification request for Campaign #{req.campaign_id.slice(0, 8)}…
                          </p>
                          {req.creator_note && (
                            <p className="text-xs text-muted-foreground italic mb-2">
                              "{req.creator_note}"
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Expires {new Date(req.expires_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                        >
                          <Link href={`/campaigns/${req.campaign_id}`} target="_blank" className="gap-1">
                            View Campaign <ExternalLink className="w-3 h-3" />
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <p className="text-xs text-muted-foreground text-center pt-2">
                  To endorse a campaign from a request, find it in the Browse Queue tab.
                </p>
              </div>
            )
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

// ─── Campaign endorsement card ────────────────────────────────────────────────

interface CampaignEndorseCardProps {
  campaign:    DbCampaign;
  isOpen:      boolean;
  onToggle:    () => void;
  form:        EndorseFormState;
  onFormChange: (patch: Partial<EndorseFormState>) => void;
  onEndorse:   () => void;
  submitting:  boolean;
}

function CampaignEndorseCard({
  campaign, isOpen, onToggle, form, onFormChange, onEndorse, submitting,
}: CampaignEndorseCardProps) {
  const pct = campaign.target_amount_eth > 0
    ? Math.min((campaign.current_amount_eth / campaign.target_amount_eth) * 100, 100)
    : 0;

  return (
    <Card className={form.done ? 'opacity-60' : ''}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-2 mb-2">
              <Badge variant="secondary" className="capitalize">{campaign.category}</Badge>
              {campaign.ai_trust_score != null && (
                <Badge className={trustColor(campaign.ai_trust_score)}>
                  AI Trust: {campaign.ai_trust_score}
                </Badge>
              )}
            </div>
            <CardTitle className="text-base leading-snug">{campaign.title}</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={onToggle} disabled={form.done}>
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>

      {isOpen && (
        <CardContent className="space-y-5 pt-0">
          <p className="text-sm text-muted-foreground leading-relaxed">{campaign.description}</p>

          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>{campaign.current_amount_eth.toFixed(3)} ETH raised</span>
              <span className="text-muted-foreground">of {campaign.target_amount_eth.toFixed(2)} ETH</span>
            </div>
            <Progress value={pct} className="h-1.5" />
          </div>

          {campaign.ai_explanation && (
            <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1.5">
              <p className="text-xs font-medium">AI Analysis</p>
              <p className="text-muted-foreground text-xs leading-relaxed">{campaign.ai_explanation}</p>
              {campaign.ai_flags && campaign.ai_flags.length > 0 && (
                <div className="space-y-0.5 mt-1">
                  {campaign.ai_flags.map((f) => (
                    <div key={f} className="flex items-center gap-1 text-xs text-warning">
                      <AlertCircle className="w-3 h-3" /> {f.replace(/_/g, ' ')}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <a
            href={`/campaigns/${campaign.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            View full campaign page <ExternalLink className="w-3 h-3" />
          </a>

          {/* Endorsement form */}
          <div className="border-t pt-4 space-y-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              <p className="text-sm font-medium">Your Endorsement</p>
            </div>

            <Alert>
              <AlertDescription className="text-sm">
                By endorsing, you confirm on behalf of your organization that you have independently
                verified this campaign's legitimacy. Your organization name will be publicly shown as a
                trust badge. Corroborating document and a note of at least 10 words are required.
              </AlertDescription>
            </Alert>

            <div className="space-y-1.5">
              <Label>Corroborating Document *</Label>
              {form.docFile ? (
                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm truncate flex-1">{form.docFile.name}</span>
                  <Button variant="ghost" size="sm" onClick={() => onFormChange({ docFile: null })}>
                    Remove
                  </Button>
                </div>
              ) : (
                <label className="flex items-center gap-2 cursor-pointer border border-dashed rounded-lg p-3 hover:border-primary transition-colors">
                  <Upload className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Upload referral letter, official letterhead, or proof document
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(e) => onFormChange({ docFile: e.target.files?.[0] ?? null })}
                  />
                </label>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Endorsement Note * (min 10 words)</Label>
              <Textarea
                placeholder="We have verified this patient's medical records at our hospital. The diagnosis is confirmed and the requested amount is consistent with the treatment costs."
                value={form.note}
                onChange={(e) => onFormChange({ note: e.target.value })}
                rows={3}
              />
              <p className="text-xs text-muted-foreground text-right">
                {form.note.trim() ? form.note.trim().split(/\s+/).length : 0} words
              </p>
            </div>

            <Button
              onClick={onEndorse}
              disabled={submitting}
              className="w-full gap-2"
            >
              {submitting ? (
                <><Loader className="w-4 h-4 animate-spin" /> Submitting…</>
              ) : (
                <><ShieldCheck className="w-4 h-4" /> Endorse This Campaign</>
              )}
            </Button>

            {form.done && (
              <Alert className="bg-success/10 border-success">
                <CheckCircle className="w-4 h-4" />
                <AlertDescription>Endorsement recorded. Campaign will go live shortly.</AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

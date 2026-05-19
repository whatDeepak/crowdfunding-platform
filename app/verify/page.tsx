'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useWeb3 } from '@/lib/web3-context';
import { toast } from 'sonner';
import {
  Loader, ShieldCheck, AlertCircle, Upload, FileText,
  ChevronDown, ChevronUp, Building2, CheckCircle,
} from 'lucide-react';
import type { DbCampaign, CampaignCategory } from '@/lib/types';

const CATEGORY_OPTIONS: { value: CampaignCategory | 'all'; label: string }[] = [
  { value: 'all',       label: 'All Categories' },
  { value: 'medical',   label: 'Medical' },
  { value: 'education', label: 'Education' },
  { value: 'disaster',  label: 'Disaster Relief' },
  { value: 'community', label: 'Community' },
];

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
  if (score === null) return 'bg-muted text-muted-foreground';
  if (score >= 70) return 'bg-success text-success-foreground';
  if (score >= 40) return 'bg-warning text-warning-foreground';
  return 'bg-destructive text-destructive-foreground';
}

export default function VerifyPage() {
  const { account, isConnected, connectWallet } = useWeb3();

  const [campaigns, setCampaigns]   = useState<DbCampaign[]>([]);
  const [loading, setLoading]       = useState(true);
  const [category, setCategory]     = useState<CampaignCategory | 'all'>('all');
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [forms, setForms]           = useState<Record<string, EndorseFormState>>({});
  const [isVerifier, setIsVerifier] = useState<boolean | null>(null);

  // Check if user is a registered verifier
  useEffect(() => {
    if (!account) { setIsVerifier(null); return; }

    fetch(`/api/users/${account}`)
      .then((r) => r.ok ? r.json() : null)
      .then((user) => setIsVerifier(user?.user_type === 'verifier'))
      .catch(() => setIsVerifier(false));
  }, [account]);

  // Fetch verification queue
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ queue: 'true' });
    if (category !== 'all') params.set('category', category);

    fetch(`/api/verifications?${params}`)
      .then((r) => r.ok ? r.json() : [])
      .then(setCampaigns)
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
  }, [category]);

  const getForm = (id: string): EndorseFormState =>
    forms[id] ?? { note: '', docFile: null, done: false };

  const updateForm = (id: string, patch: Partial<EndorseFormState>) =>
    setForms((prev) => ({ ...prev, [id]: { ...getForm(id), ...patch } }));

  const handleEndorse = async (campaign: DbCampaign) => {
    if (!account) return;
    const form = getForm(campaign.id);

    setSubmitting(campaign.id);
    try {
      let docCid: string | undefined;
      if (form.docFile) {
        toast.loading('Uploading endorsement document…');
        docCid = await uploadFile(form.docFile);
      }

      toast.loading('Submitting endorsement…');
      const res = await fetch('/api/verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId:             campaign.id,
          verifierWallet:         account,
          endorsementNote:        form.note.trim() || undefined,
          corroboratingDocIpfs:   docCid,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Endorsement failed');
      }

      toast.success('Campaign endorsed! It will go live shortly.');
      updateForm(campaign.id, { done: true });
      // Remove from queue after short delay
      setTimeout(() => setCampaigns((prev) => prev.filter((c) => c.id !== campaign.id)), 2000);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to submit endorsement');
    } finally {
      setSubmitting(null);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Verifier Login Required</h1>
            <p className="text-muted-foreground mb-6">
              Connect your wallet to access the verification queue.
            </p>
            <Button onClick={connectWallet}>Connect MetaMask</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (isVerifier === false) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <AlertCircle className="w-12 h-12 text-warning mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Not a Registered Verifier</h1>
            <p className="text-muted-foreground">
              This page is for trusted organizations (hospitals, NGOs, universities) registered
              as verifiers on the platform. Contact the admin to register your organization.
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
      <main className="flex-1">
        <div className="bg-gradient-to-b from-muted/50 to-background py-10">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-3 mb-2">
              <ShieldCheck className="w-7 h-7 text-primary" />
              <h1 className="text-3xl font-bold">Verification Queue</h1>
            </div>
            <p className="text-muted-foreground">
              Review campaigns that need a trusted organization endorsement to go live.
              Your endorsement is publicly attributed to your organization.
            </p>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 max-w-3xl">
          {/* Category filter */}
          <div className="flex justify-end mb-6">
            <Select value={category} onValueChange={(v) => setCategory(v as CampaignCategory | 'all')}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading || isVerifier === null ? (
            <div className="flex justify-center py-20">
              <Loader className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <CheckCircle className="w-10 h-10 mx-auto mb-3 text-success" />
              <p className="text-lg font-medium">Queue is clear!</p>
              <p className="text-sm">No campaigns pending verification right now.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {campaigns.map((c) => {
                const form    = getForm(c.id);
                const isOpen  = expanded === c.id;
                const isBusy  = submitting === c.id;
                const pct     = c.target_amount_eth > 0
                  ? Math.min((c.current_amount_eth / c.target_amount_eth) * 100, 100)
                  : 0;

                return (
                  <Card key={c.id} className={form.done ? 'opacity-60' : ''}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap gap-2 mb-2">
                            <Badge variant="secondary" className="capitalize">{c.category}</Badge>
                            {c.ai_trust_score != null && (
                              <Badge className={trustColor(c.ai_trust_score)}>
                                AI Trust: {c.ai_trust_score}
                              </Badge>
                            )}
                          </div>
                          <CardTitle className="text-lg leading-tight">{c.title}</CardTitle>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpanded(isOpen ? null : c.id)}
                          disabled={form.done}
                        >
                          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      </div>
                    </CardHeader>

                    {isOpen && (
                      <CardContent className="space-y-5 pt-0">
                        {/* Campaign description */}
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {c.description}
                        </p>

                        {/* Funding progress */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>{c.current_amount_eth.toFixed(3)} ETH raised</span>
                            <span className="text-muted-foreground">
                              of {c.target_amount_eth.toFixed(2)} ETH
                            </span>
                          </div>
                          <Progress value={pct} className="h-1.5" />
                        </div>

                        {/* AI analysis */}
                        {c.ai_explanation && (
                          <div className="p-3 bg-muted/50 rounded-lg">
                            <p className="text-xs font-medium mb-1">AI Analysis</p>
                            <p className="text-sm text-muted-foreground">{c.ai_explanation}</p>
                            {c.ai_flags && (c.ai_flags as string[]).length > 0 && (
                              <div className="mt-2 space-y-1">
                                {(c.ai_flags as string[]).map((f) => (
                                  <div key={f} className="flex items-center gap-1 text-xs text-warning">
                                    <AlertCircle className="w-3 h-3" />
                                    <span>{f.replace(/_/g, ' ')}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* View full campaign */}
                        <a
                          href={`/campaigns/${c.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline"
                        >
                          View full campaign →
                        </a>

                        {/* Endorsement form */}
                        <div className="border-t pt-4 space-y-4">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-primary" />
                            <p className="text-sm font-medium">Your Endorsement</p>
                          </div>

                          <Alert>
                            <AlertDescription className="text-sm">
                              By endorsing, you confirm (on behalf of your organization) that you have
                              independently verified this campaign's legitimacy. Your organization name
                              will be publicly displayed as a trust badge.
                            </AlertDescription>
                          </Alert>

                          <div className="space-y-2">
                            <Label>Endorsement Note (optional)</Label>
                            <Textarea
                              placeholder="e.g., We have verified this patient's records at our hospital and confirm the medical need."
                              value={form.note}
                              onChange={(e) => updateForm(c.id, { note: e.target.value })}
                              rows={3}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Corroborating Document (optional but recommended)</Label>
                            {form.docFile ? (
                              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                                <FileText className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm truncate">{form.docFile.name}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => updateForm(c.id, { docFile: null })}
                                >
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
                                  onChange={(e) => updateForm(c.id, { docFile: e.target.files?.[0] ?? null })}
                                />
                              </label>
                            )}
                          </div>

                          <Button
                            onClick={() => handleEndorse(c)}
                            disabled={isBusy}
                            className="w-full gap-2"
                          >
                            {isBusy ? (
                              <><Loader className="w-4 h-4 animate-spin" /> Submitting…</>
                            ) : (
                              <><ShieldCheck className="w-4 h-4" /> Endorse This Campaign</>
                            )}
                          </Button>
                        </div>

                        {form.done && (
                          <Alert className="bg-success/10 border-success">
                            <CheckCircle className="w-4 h-4" />
                            <AlertDescription>Endorsement recorded. Campaign is now live.</AlertDescription>
                          </Alert>
                        )}
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

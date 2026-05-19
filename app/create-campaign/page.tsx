'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWeb3 } from '@/lib/web3-context';
import { toast } from 'sonner';
import { ethers } from 'ethers';
import {
  Loader, AlertCircle, CheckCircle, Plus, Trash2,
  Upload, ImageIcon, FileText, ChevronRight, ChevronLeft, Rocket,
} from 'lucide-react';
import type { CampaignCategory } from '@/lib/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MilestoneInput {
  title:       string;
  description: string;
  amount:      string;
}

interface FormState {
  // Step 1
  title:        string;
  description:  string;
  category:     CampaignCategory;
  durationDays: string;
  imageFile:    File | null;
  imageCid:     string | null;
  imagePreview: string | null;
  // Step 2
  milestones: MilestoneInput[];
  // Step 3
  docFiles:   File[];
  docCids:    string[];
}

interface AiResult {
  trust_score:   number;
  risk_level:    'low' | 'medium' | 'high';
  flags:         string[];
  explanation:   string;
  campaignDbId:  string;
  campaignStatus: string;
}

const INITIAL_MILESTONE: MilestoneInput = { title: '', description: '', amount: '' };

const STEPS = ['Story', 'Milestones', 'Documents', 'Review & Submit'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function uploadFile(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/upload', { method: 'POST', body: form });
  if (!res.ok) throw new Error('Upload failed');
  const { cid } = await res.json();
  return cid as string;
}

function trustColor(score: number) {
  if (score >= 70) return 'text-success';
  if (score >= 40) return 'text-warning';
  return 'text-destructive';
}

function riskLabel(risk: string) {
  return risk.charAt(0).toUpperCase() + risk.slice(1);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CreateCampaignPage() {
  const router = useRouter();
  const { contract, account, isConnected } = useWeb3();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef  = useRef<HTMLInputElement>(null);

  const [step, setStep]           = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [aiResult, setAiResult]   = useState<AiResult | null>(null);

  const [form, setForm] = useState<FormState>({
    title:        '',
    description:  '',
    category:     'medical',
    durationDays: '30',
    imageFile:    null,
    imageCid:     null,
    imagePreview: null,
    milestones:   [{ ...INITIAL_MILESTONE }],
    docFiles:     [],
    docCids:      [],
  });

  // ── Field updates ──────────────────────────────────────────────────────────

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setMilestone = (idx: number, field: keyof MilestoneInput, value: string) =>
    setForm((prev) => {
      const ms = [...prev.milestones];
      ms[idx] = { ...ms[idx], [field]: value };
      return { ...prev, milestones: ms };
    });

  const addMilestone = () => {
    if (form.milestones.length >= 4) return;
    setForm((prev) => ({ ...prev, milestones: [...prev.milestones, { ...INITIAL_MILESTONE }] }));
  };

  const removeMilestone = (idx: number) =>
    setForm((prev) => ({
      ...prev,
      milestones: prev.milestones.filter((_, i) => i !== idx),
    }));

  // ── Image upload ──────────────────────────────────────────────────────────

  const handleImageSelect = (file: File) => {
    const preview = URL.createObjectURL(file);
    setForm((prev) => ({ ...prev, imageFile: file, imagePreview: preview, imageCid: null }));
  };

  // ── Doc upload ────────────────────────────────────────────────────────────

  const handleDocSelect = (files: FileList) => {
    const newFiles = Array.from(files).slice(0, 5 - form.docFiles.length);
    setForm((prev) => ({ ...prev, docFiles: [...prev.docFiles, ...newFiles] }));
  };

  const removeDoc = (idx: number) =>
    setForm((prev) => ({ ...prev, docFiles: prev.docFiles.filter((_, i) => i !== idx) }));

  // ── Validation ────────────────────────────────────────────────────────────

  const totalEth = form.milestones.reduce((s, m) => s + (parseFloat(m.amount) || 0), 0);

  const canProceed = (): boolean => {
    if (step === 0) return !!(form.title.trim() && form.description.trim().length >= 50 && form.durationDays);
    if (step === 1) return form.milestones.length >= 1 && form.milestones.every(
      (m) => m.title.trim() && m.description.trim() && parseFloat(m.amount) > 0
    ) && totalEth > 0;
    if (step === 2) return true; // docs are optional
    if (step === 3) return isConnected;
    return false;
  };

  // ── Submit: upload → create DB → run AI ───────────────────────────────────

  const handleAnalyze = async () => {
    if (!isConnected || !account) {
      toast.error('Connect your wallet first');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Upload campaign image
      let imageCid = form.imageCid;
      if (form.imageFile && !imageCid) {
        toast.loading('Uploading campaign image…');
        imageCid = await uploadFile(form.imageFile);
        set('imageCid', imageCid);
      }

      // 2. Upload supporting documents
      let docCids = form.docCids;
      if (form.docFiles.length > form.docCids.length) {
        toast.loading('Uploading documents…');
        const newFiles = form.docFiles.slice(form.docCids.length);
        const newCids  = await Promise.all(newFiles.map(uploadFile));
        docCids = [...form.docCids, ...newCids];
        set('docCids', docCids);
      }

      const gateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY ?? 'https://gateway.pinata.cloud/ipfs/';
      const imageUrl = imageCid ? `${gateway}${imageCid}` : null;

      // 3. Create campaign in DB
      toast.loading('Saving campaign…');
      const createRes = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creator_wallet:    account,
          title:             form.title.trim(),
          description:       form.description.trim(),
          category:          form.category,
          image_url:         imageUrl,
          target_amount_eth: totalEth,
          deadline:          new Date(Date.now() + parseInt(form.durationDays) * 86400_000).toISOString(),
        }),
      });
      if (!createRes.ok) throw new Error('Failed to create campaign');
      const campaign = await createRes.json();

      // 4. Create milestones
      await fetch('/api/milestones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: campaign.id,
          milestones: form.milestones.map((m) => ({
            title:             m.title.trim(),
            description:       m.description.trim(),
            target_amount_eth: parseFloat(m.amount),
          })),
        }),
      });

      // 5. Run AI analysis
      toast.loading('Analyzing with AI pipeline…');
      const aiRes = await fetch('/api/ai/verify-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId:      campaign.id,
          imageUrl,
          documentIpfsCids: docCids,
        }),
      });
      if (!aiRes.ok) throw new Error('AI analysis failed');
      const aiData = await aiRes.json();

      setAiResult({
        trust_score:    aiData.trust_score,
        risk_level:     aiData.risk_level,
        flags:          aiData.flags ?? [],
        explanation:    aiData.explanation ?? '',
        campaignDbId:   campaign.id,
        campaignStatus: aiData.campaign_status ?? 'pending_review',
      });

      toast.dismiss();
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Publish: MetaMask tx → update contract_id ─────────────────────────────

  const handlePublish = async () => {
    if (!contract || !aiResult) return;

    setPublishing(true);
    try {
      toast.loading('Confirm transaction in MetaMask…');
      const targetWei = ethers.parseEther(totalEth.toString());
      const days      = parseInt(form.durationDays);
      const ipfsHash  = form.imageCid ?? 'QmNone';

      const tx      = await contract.createCampaign(targetWei, days, ipfsHash);
      toast.loading('Waiting for confirmation…');
      const receipt = await tx.wait();

      // Parse contract_id from CampaignCreated event
      const iface   = contract.interface;
      let contractId: number | null = null;
      for (const log of receipt.logs ?? []) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed?.name === 'CampaignCreated') {
            contractId = Number(parsed.args[0]);
            break;
          }
        } catch { /* skip non-matching logs */ }
      }

      // Update DB with on-chain campaign ID
      await fetch(`/api/campaigns/${aiResult.campaignDbId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId }),
      });

      toast.success('Campaign published on blockchain!');
      router.push(`/campaigns/${aiResult.campaignDbId}`);
    } catch (err) {
      console.error(err);
      toast.error('Transaction failed. Please try again.');
    } finally {
      setPublishing(false);
    }
  };

  // ── Not connected guard ───────────────────────────────────────────────────

  if (!isConnected && step === 3) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-20">
          <div className="max-w-md mx-auto text-center">
            <AlertCircle className="w-12 h-12 text-warning mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Connect Your Wallet</h1>
            <p className="text-muted-foreground">Connect MetaMask to submit your campaign.</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ── AI Result screen ──────────────────────────────────────────────────────

  if (aiResult) {
    const statusMessages: Record<string, string> = {
      active:               'Your campaign scored highly and is now live! Donors can see it immediately.',
      pending_verification: 'A trusted verifier (hospital, NGO) needs to endorse your campaign before it goes live.',
      pending_review:       'Your campaign has been flagged for admin review. We\'ll evaluate it within 48 hours.',
    };

    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-16 max-w-2xl">
          <h1 className="text-3xl font-bold mb-8">AI Analysis Complete</h1>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Trust Score</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <span className={`text-6xl font-bold ${trustColor(aiResult.trust_score)}`}>
                  {aiResult.trust_score}
                </span>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">out of 100</div>
                  <Badge className={
                    aiResult.risk_level === 'low'    ? 'bg-success text-success-foreground' :
                    aiResult.risk_level === 'medium' ? 'bg-warning text-warning-foreground' :
                    'bg-destructive text-destructive-foreground'
                  }>
                    {riskLabel(aiResult.risk_level)} Risk
                  </Badge>
                </div>
              </div>

              <Progress value={aiResult.trust_score} className="h-3" />

              {aiResult.explanation && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {aiResult.explanation}
                </p>
              )}

              {aiResult.flags.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-medium">Flags:</p>
                  {aiResult.flags.map((f) => (
                    <div key={f} className="flex items-center gap-2 text-sm text-warning">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{f.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Alert className="mb-6">
            <CheckCircle className="w-4 h-4" />
            <AlertDescription>
              {statusMessages[aiResult.campaignStatus] ?? 'Your campaign has been submitted for review.'}
            </AlertDescription>
          </Alert>

          <div className="flex gap-3">
            <Button
              onClick={handlePublish}
              disabled={publishing}
              size="lg"
              className="flex-1 gap-2"
            >
              {publishing ? (
                <><Loader className="w-4 h-4 animate-spin" /> Publishing…</>
              ) : (
                <><Rocket className="w-4 h-4" /> Publish on Blockchain</>
              )}
            </Button>
            <Button variant="outline" onClick={() => router.push('/campaigns')}>
              View Campaigns
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ── Multi-step form ───────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="bg-gradient-to-b from-muted/50 to-background py-10">
          <div className="container mx-auto px-4">
            <h1 className="text-4xl font-bold mb-2">Create a Campaign</h1>
            <p className="text-muted-foreground">
              Your campaign will be analyzed by our AI fraud detection pipeline before going live.
            </p>
          </div>
        </div>

        <div className="container mx-auto px-4 py-10 max-w-2xl">
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-8">
            {STEPS.map((label, i) => (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0
                  ${i < step ? 'bg-success text-success-foreground' :
                    i === step ? 'bg-primary text-primary-foreground' :
                    'bg-muted text-muted-foreground'}`}>
                  {i < step ? <CheckCircle className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-sm hidden sm:block ${i === step ? 'font-medium' : 'text-muted-foreground'}`}>
                  {label}
                </span>
                {i < STEPS.length - 1 && <div className="flex-1 h-px bg-muted mx-2" />}
              </div>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{STEPS[step]}</CardTitle>
              <CardDescription>
                {step === 0 && 'Tell donors your story and why you need support.'}
                {step === 1 && 'Break your funding goal into milestones (1–4). Funds are released per milestone.'}
                {step === 2 && 'Upload identity proof, medical records, or other supporting documents. These build trust.'}
                {step === 3 && 'Review your campaign before AI analysis and blockchain publication.'}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* ── Step 0: Story ── */}
              {step === 0 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="title">Campaign Title *</Label>
                    <Input
                      id="title"
                      placeholder="e.g., Surgery for 8-year-old Priya"
                      value={form.title}
                      onChange={(e) => set('title', e.target.value)}
                      maxLength={200}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Your Story *</Label>
                    <Textarea
                      id="description"
                      placeholder="Explain the situation in detail. Who needs help? Why? How will the funds be used? (minimum 50 characters)"
                      value={form.description}
                      onChange={(e) => set('description', e.target.value)}
                      rows={7}
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {form.description.length} chars
                      {form.description.length < 50 && <span className="text-destructive"> (min 50)</span>}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Category *</Label>
                      <Select value={form.category} onValueChange={(v) => set('category', v as CampaignCategory)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="medical">Medical</SelectItem>
                          <SelectItem value="education">Education</SelectItem>
                          <SelectItem value="disaster">Disaster Relief</SelectItem>
                          <SelectItem value="community">Community</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="duration">Duration (days) *</Label>
                      <Input
                        id="duration"
                        type="number"
                        min={7}
                        max={90}
                        value={form.durationDays}
                        onChange={(e) => set('durationDays', e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Image upload */}
                  <div className="space-y-2">
                    <Label>Campaign Image (optional)</Label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])}
                    />
                    {form.imagePreview ? (
                      <div className="relative">
                        <img
                          src={form.imagePreview}
                          alt="Campaign"
                          className="w-full h-48 object-cover rounded-lg border"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => setForm((p) => ({ ...p, imageFile: null, imageCid: null, imagePreview: null }))}
                        >
                          Change
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-32 border-2 border-dashed border-muted rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                      >
                        <ImageIcon className="w-8 h-8" />
                        <span className="text-sm">Click to upload an image</span>
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* ── Step 1: Milestones ── */}
              {step === 1 && (
                <div className="space-y-4">
                  {form.milestones.map((m, i) => (
                    <Card key={i} className="p-4 space-y-3 bg-muted/30">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Milestone {i + 1}</span>
                        {form.milestones.length > 1 && (
                          <Button variant="ghost" size="sm" onClick={() => removeMilestone(i)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Input
                          placeholder="Milestone title (e.g., Surgery completion)"
                          value={m.title}
                          onChange={(e) => setMilestone(i, 'title', e.target.value)}
                        />
                        <Textarea
                          placeholder="What will be accomplished and what proof will be provided?"
                          value={m.description}
                          onChange={(e) => setMilestone(i, 'description', e.target.value)}
                          rows={2}
                        />
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder="ETH amount"
                            value={m.amount}
                            onChange={(e) => setMilestone(i, 'amount', e.target.value)}
                            className="w-36"
                          />
                          <span className="text-sm text-muted-foreground">ETH</span>
                        </div>
                      </div>
                    </Card>
                  ))}

                  {form.milestones.length < 4 && (
                    <Button variant="outline" onClick={addMilestone} className="w-full gap-2">
                      <Plus className="w-4 h-4" />
                      Add Milestone
                    </Button>
                  )}

                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-sm font-medium">Total target:</span>
                    <span className="font-bold">{totalEth.toFixed(3)} ETH</span>
                  </div>
                </div>
              )}

              {/* ── Step 2: Documents ── */}
              {step === 2 && (
                <div className="space-y-4">
                  <Alert>
                    <AlertDescription>
                      Documents help our AI and trusted verifiers validate your campaign. Upload medical records,
                      identity proof, cost estimates, or official letters. Stored securely on IPFS.
                    </AlertDescription>
                  </Alert>

                  <input
                    ref={docInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    className="hidden"
                    onChange={(e) => e.target.files && handleDocSelect(e.target.files)}
                  />

                  {form.docFiles.length < 5 && (
                    <button
                      type="button"
                      onClick={() => docInputRef.current?.click()}
                      className="w-full h-28 border-2 border-dashed border-muted rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    >
                      <Upload className="w-6 h-6" />
                      <span className="text-sm">Upload documents (PDF, images — max 10MB each)</span>
                    </button>
                  )}

                  {form.docFiles.map((file, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({(file.size / 1024).toFixed(0)} KB)
                        </span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeDoc(i)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}

                  {form.docFiles.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground">
                      No documents added — you can skip this step, but it may lower your trust score.
                    </p>
                  )}
                </div>
              )}

              {/* ── Step 3: Review ── */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Title</p>
                      <p className="font-medium">{form.title}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Category</p>
                      <p className="font-medium capitalize">{form.category}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Duration</p>
                      <p className="font-medium">{form.durationDays} days</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Target</p>
                      <p className="font-medium">{totalEth.toFixed(3)} ETH</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Story</p>
                    <p className="text-sm leading-relaxed line-clamp-4">{form.description}</p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Milestones ({form.milestones.length})</p>
                    {form.milestones.map((m, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                        <span className="text-sm">{m.title}</span>
                        <span className="text-sm font-medium">{m.amount} ETH</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Documents: {form.docFiles.length} file{form.docFiles.length !== 1 ? 's' : ''}</span>
                    <span>Image: {form.imageFile ? 'uploaded' : 'none'}</span>
                  </div>

                  {!isConnected && (
                    <Alert className="border-destructive bg-destructive/10">
                      <AlertCircle className="w-4 h-4" />
                      <AlertDescription>Connect your wallet to publish this campaign.</AlertDescription>
                    </Alert>
                  )}

                  <Alert>
                    <AlertDescription className="text-sm">
                      Clicking "Analyze & Submit" will run our AI fraud detection pipeline (text quality,
                      duplicate detection, amount reasonableness). You'll see your trust score before
                      publishing to the blockchain.
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {/* Navigation buttons */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="outline"
                  onClick={() => setStep((s) => s - 1)}
                  disabled={step === 0 || submitting}
                  className="gap-2"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </Button>

                {step < 3 ? (
                  <Button
                    onClick={() => setStep((s) => s + 1)}
                    disabled={!canProceed()}
                    className="gap-2"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleAnalyze}
                    disabled={submitting || !isConnected}
                    className="gap-2"
                  >
                    {submitting ? (
                      <><Loader className="w-4 h-4 animate-spin" /> Analyzing…</>
                    ) : (
                      <>Analyze & Submit</>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}

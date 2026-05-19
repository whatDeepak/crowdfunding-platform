'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import {
  Building2, Upload, FileText, CheckCircle, Loader, AlertCircle, ExternalLink,
} from 'lucide-react';
import type { DbOrganization, OrgType, GeographicScope, CampaignCategory } from '@/lib/types';

const ORG_TYPE_LABELS: Record<OrgType, string> = {
  hospital:   'Hospital / Clinic',
  ngo:        'Non-Governmental Organization (NGO)',
  university: 'University / College',
  pharmacy:   'Pharmacy',
  legal_aid:  'Legal Aid Organization',
  other:      'Other',
};

const ORG_TYPE_REG_LABEL: Record<OrgType, string> = {
  hospital:   'Hospital Accreditation / NABH Number',
  ngo:        '12A / 80G / FCRA / DARPAN Number',
  university: 'UGC / AICTE Code',
  pharmacy:   'Drug License Number',
  legal_aid:  'Bar Council / Registration Number',
  other:      'Registration Number',
};

const ORG_TYPE_DOMAINS: Record<OrgType, CampaignCategory[]> = {
  hospital:   ['medical'],
  ngo:        ['disaster', 'community', 'medical'],
  university: ['education'],
  pharmacy:   ['medical'],
  legal_aid:  ['community'],
  other:      [],
};

const CATEGORIES: { value: CampaignCategory; label: string }[] = [
  { value: 'medical',   label: 'Medical' },
  { value: 'education', label: 'Education' },
  { value: 'disaster',  label: 'Disaster Relief' },
  { value: 'community', label: 'Community' },
];

async function uploadFile(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/upload', { method: 'POST', body: form });
  if (!res.ok) throw new Error('Document upload failed');
  return (await res.json()).cid as string;
}

export default function RegisterOrganizationPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [existingOrg, setExistingOrg] = useState<DbOrganization | null>(null);
  const [checkingOrg, setCheckingOrg] = useState(true);

  // Form state
  const [orgName, setOrgName]           = useState('');
  const [orgType, setOrgType]           = useState<OrgType | ''>('');
  const [regNumber, setRegNumber]       = useState('');
  const [website, setWebsite]           = useState('');
  const [responsiblePerson, setRespPerson] = useState('');
  const [geoScope, setGeoScope]         = useState<GeographicScope>('state');
  const [domains, setDomains]           = useState<CampaignCategory[]>([]);
  const [regDoc, setRegDoc]             = useState<File | null>(null);
  const [confirmed, setConfirmed]       = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);

  // Check for existing org registration
  useEffect(() => {
    if (!user) return;
    fetch('/api/organizations/my')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data && !data.error) setExistingOrg(data); })
      .finally(() => setCheckingOrg(false));
  }, [user]);

  // Auto-set domains when org type changes
  useEffect(() => {
    if (orgType) {
      setDomains(ORG_TYPE_DOMAINS[orgType as OrgType] ?? []);
    }
  }, [orgType]);

  const toggleDomain = (cat: CampaignCategory) => {
    setDomains((prev) =>
      prev.includes(cat) ? prev.filter((d) => d !== cat) : [...prev, cat]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName || !orgType || !regNumber || !responsiblePerson || !domains.length) {
      toast.error('Please fill all required fields');
      return;
    }
    if (!regDoc) {
      toast.error('Please upload your registration certificate');
      return;
    }
    if (!confirmed) {
      toast.error('Please confirm the accuracy of your information');
      return;
    }

    setSubmitting(true);
    try {
      toast.loading('Uploading registration certificate…');
      const regDocCid = await uploadFile(regDoc);

      toast.loading('Submitting registration…');
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_name:              orgName.trim(),
          org_type:              orgType,
          registration_number:   regNumber.trim(),
          registration_doc_ipfs: regDocCid,
          website_url:           website.trim() || undefined,
          responsible_person:    responsiblePerson.trim(),
          geographic_scope:      geoScope,
          domains,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.org) {
          setExistingOrg(data.org);
          return;
        }
        throw new Error(data.error ?? 'Registration failed');
      }

      setSubmitted(true);
      toast.success('Registration submitted! The admin team will review your application.');
    } catch (err: any) {
      toast.error(err?.message ?? 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || checkingOrg) {
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
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Sign in required</h1>
            <p className="text-muted-foreground mb-6">
              Create an account to register your organization as a Trusted Verifier.
            </p>
            <Button asChild>
              <Link href="/login?next=/register/organization">Sign In</Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (submitted || existingOrg) {
    const org = existingOrg;
    const statusLabels: Record<string, { label: string; color: string; desc: string }> = {
      pending_approval: {
        label: 'Pending Review',
        color: 'bg-warning text-warning-foreground',
        desc: 'Your registration has been submitted. The admin team will review it within 2 business days.',
      },
      more_info_needed: {
        label: 'More Info Needed',
        color: 'bg-orange-500 text-white',
        desc: 'The admin has requested additional information. Please check the notes below.',
      },
      active: {
        label: 'Active',
        color: 'bg-success text-success-foreground',
        desc: 'Your organization is approved and can endorse campaigns. Visit the Verifier Dashboard to get started.',
      },
      rejected: {
        label: 'Rejected',
        color: 'bg-destructive text-destructive-foreground',
        desc: 'Your registration was not approved. You may re-apply with updated information.',
      },
      suspended: {
        label: 'Suspended',
        color: 'bg-destructive text-destructive-foreground',
        desc: 'Your organization has been suspended. Contact the admin team for details.',
      },
    };

    const st = org ? statusLabels[org.status] : statusLabels['pending_approval'];

    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-12 max-w-2xl">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <Building2 className="w-6 h-6 text-primary" />
                <CardTitle>{org?.org_name ?? orgName}</CardTitle>
                {org && <Badge className={st.color}>{st.label}</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className={org?.status === 'active' ? 'border-success' : ''}>
                <CheckCircle className="w-4 h-4" />
                <AlertDescription>{st.desc}</AlertDescription>
              </Alert>

              {org?.admin_notes && (
                <div className="p-3 bg-muted/50 rounded-lg text-sm">
                  <p className="font-medium text-xs text-muted-foreground mb-1 uppercase tracking-wide">
                    Admin note
                  </p>
                  <p>{org.admin_notes}</p>
                </div>
              )}

              {org?.status === 'active' && (
                <Button asChild className="w-full">
                  <Link href="/verify">Go to Verifier Dashboard</Link>
                </Button>
              )}

              {org?.status === 'rejected' && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => { setExistingOrg(null); setSubmitted(false); }}
                >
                  Re-apply with Updated Information
                </Button>
              )}
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-2xl">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Register as Trusted Verifier</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Hospitals, NGOs, universities, and other registered institutions can become Trusted
            Verifiers — endorsing campaigns to help genuine causes reach donors faster.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Organization Name */}
          <div className="space-y-1.5">
            <Label htmlFor="orgName">Organization Name *</Label>
            <Input
              id="orgName"
              placeholder="City Civil Hospital Nagpur"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
            />
          </div>

          {/* Organization Type */}
          <div className="space-y-1.5">
            <Label>Organization Type *</Label>
            <Select value={orgType} onValueChange={(v) => setOrgType(v as OrgType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(ORG_TYPE_LABELS) as [OrgType, string][]).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Registration Number — label changes by org type */}
          <div className="space-y-1.5">
            <Label htmlFor="regNumber">
              {orgType ? ORG_TYPE_REG_LABEL[orgType as OrgType] : 'Registration Number'} *
            </Label>
            <Input
              id="regNumber"
              placeholder="e.g., MH/NGO/2024/12345"
              value={regNumber}
              onChange={(e) => setRegNumber(e.target.value)}
              required
            />
          </div>

          {/* Responsible Person */}
          <div className="space-y-1.5">
            <Label htmlFor="respPerson">Responsible Person Name & Title *</Label>
            <Input
              id="respPerson"
              placeholder="Dr. Priya Menon, Medical Director"
              value={responsiblePerson}
              onChange={(e) => setRespPerson(e.target.value)}
              required
            />
          </div>

          {/* Website */}
          <div className="space-y-1.5">
            <Label htmlFor="website">Official Website (optional)</Label>
            <Input
              id="website"
              type="url"
              placeholder="https://example.org"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          {/* Geographic Scope */}
          <div className="space-y-2">
            <Label>Geographic Scope *</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['local', 'state', 'national', 'international'] as GeographicScope[]).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => setGeoScope(scope)}
                  className={`p-2 rounded-lg border text-sm transition-colors ${
                    geoScope === scope
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-muted-foreground/30 text-muted-foreground hover:border-primary'
                  }`}
                >
                  {scope.charAt(0).toUpperCase() + scope.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Verification Domains */}
          <div className="space-y-2">
            <Label>Verification Domains *</Label>
            <p className="text-xs text-muted-foreground">
              Which campaign categories can your organization verify?
            </p>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => (
                <label
                  key={cat.value}
                  className="flex items-center gap-2 p-2.5 border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <Checkbox
                    checked={domains.includes(cat.value)}
                    onCheckedChange={() => toggleDomain(cat.value)}
                  />
                  <span className="text-sm">{cat.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Registration Certificate Upload */}
          <div className="space-y-1.5">
            <Label>Registration Certificate *</Label>
            <p className="text-xs text-muted-foreground">
              Upload an official document proving your organization's registration
              (certificate, accreditation letter, or license).
            </p>
            {regDoc ? (
              <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm truncate flex-1">{regDoc.name}</span>
                <Button variant="ghost" size="sm" onClick={() => setRegDoc(null)}>
                  Remove
                </Button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 p-4 border border-dashed rounded-lg cursor-pointer hover:border-primary hover:text-primary text-muted-foreground transition-colors">
                <Upload className="w-4 h-4" />
                <span className="text-sm">Upload PDF, JPG, or PNG</span>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setRegDoc(e.target.files?.[0] ?? null)}
                />
              </label>
            )}
          </div>

          {/* Confirmation */}
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={confirmed}
              onCheckedChange={(v) => setConfirmed(!!v)}
              className="mt-0.5"
            />
            <span className="text-sm text-muted-foreground">
              I confirm that the information provided is accurate and that my organization
              accepts accountability for any campaign endorsements made through this platform.
            </span>
          </label>

          <Button
            type="submit"
            disabled={submitting || !confirmed}
            className="w-full gap-2"
            size="lg"
          >
            {submitting ? (
              <><Loader className="w-4 h-4 animate-spin" /> Submitting…</>
            ) : (
              <><CheckCircle className="w-4 h-4" /> Submit for Review</>
            )}
          </Button>
        </form>
      </main>
      <Footer />
    </div>
  );
}

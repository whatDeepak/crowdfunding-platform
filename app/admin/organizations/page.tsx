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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import {
  Loader, Building2, CheckCircle, XCircle, AlertCircle,
  ChevronDown, ChevronUp, ExternalLink, Shield,
} from 'lucide-react';
import type { DbOrganization } from '@/lib/types';

const STATUS_BADGE: Record<string, string> = {
  pending_approval: 'bg-warning text-warning-foreground',
  more_info_needed: 'bg-orange-500 text-white',
  active:           'bg-success text-success-foreground',
  rejected:         'bg-destructive text-destructive-foreground',
  suspended:        'bg-destructive/70 text-destructive-foreground',
};

const PINATA_GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY ?? 'https://gateway.pinata.cloud/ipfs/';

export default function AdminOrganizationsPage() {
  const { isAdmin, user } = useAuth();

  const [orgs, setOrgs]       = useState<DbOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [acting, setActing]   = useState<string | null>(null);
  const [notes, setNotes]     = useState<Record<string, string>>({});
  const [tiers, setTiers]     = useState<Record<string, string>>({});
  const [filter, setFilter]   = useState<string>('pending_approval');

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    fetch(`/api/organizations?status=${filter}`)
      .then((r) => r.ok ? r.json() : [])
      .then(setOrgs)
      .catch(() => setOrgs([]))
      .finally(() => setLoading(false));
  }, [isAdmin, filter]);

  const handleAction = async (
    org: DbOrganization,
    action: 'approve' | 'reject' | 'request_more_info' | 'suspend'
  ) => {
    if ((action === 'reject' || action === 'request_more_info') && !notes[org.id]?.trim()) {
      toast.error('Please provide a note for this action');
      return;
    }

    setActing(org.id);
    try {
      const res = await fetch(`/api/admin/organizations/${org.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          tier:        tiers[org.id] ? Number(tiers[org.id]) : undefined,
          admin_notes: notes[org.id]?.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Action failed');
        return;
      }

      const labels = {
        approve:           'approved',
        reject:            'rejected',
        request_more_info: 'flagged for more info',
        suspend:           'suspended',
      };
      toast.success(`Organization ${labels[action]}`);

      // Refresh list
      setOrgs((prev) => prev.filter((o) => o.id !== org.id));
    } catch (err: any) {
      toast.error(err?.message ?? 'Action failed');
    } finally {
      setActing(null);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <Button asChild><Link href="/login?next=/admin/organizations">Sign In</Link></Button>
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
            <p className="text-muted-foreground">Admin access required.</p>
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Organization Applications</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Review and approve trusted verifier registrations.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/admin">← Back to Admin</Link>
          </Button>
        </div>

        {/* Filter */}
        <div className="mb-6">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending_approval">Pending Review</SelectItem>
              <SelectItem value="more_info_needed">More Info Needed</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : orgs.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>No organizations with this status.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orgs.map((org) => {
              const isOpen = expanded === org.id;
              return (
                <Card key={org.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap gap-2 mb-1.5">
                          <Badge className={STATUS_BADGE[org.status] ?? 'bg-muted'}>
                            {org.status.replace(/_/g, ' ')}
                          </Badge>
                          <Badge variant="outline">Tier {org.tier}</Badge>
                          <Badge variant="secondary">{org.org_type.replace(/_/g, ' ')}</Badge>
                        </div>
                        <CardTitle className="text-base">{org.org_name}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          {org.contact_email} · Reg: {org.registration_number} ·{' '}
                          {new Date(org.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpanded(isOpen ? null : org.id)}
                      >
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </div>
                  </CardHeader>

                  {isOpen && (
                    <CardContent className="space-y-5 pt-0">
                      {/* Details grid */}
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Responsible Person</p>
                          <p className="font-medium">{org.responsible_person}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Geographic Scope</p>
                          <p className="font-medium capitalize">{org.geographic_scope}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Verification Domains</p>
                          <div className="flex flex-wrap gap-1">
                            {org.domains.map((d) => (
                              <Badge key={d} variant="secondary" className="text-xs">{d}</Badge>
                            ))}
                          </div>
                        </div>
                        {org.website_url && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-0.5">Website</p>
                            <a
                              href={org.website_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary text-xs flex items-center gap-1 hover:underline"
                            >
                              {org.website_url.replace(/^https?:\/\//, '')}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Registration certificate */}
                      {org.registration_doc_ipfs && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1.5">
                            Registration Certificate
                          </p>
                          <a
                            href={`${PINATA_GATEWAY}${org.registration_doc_ipfs}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            View uploaded document
                          </a>
                        </div>
                      )}

                      {/* Admin notes (existing) */}
                      {org.admin_notes && (
                        <div className="p-3 bg-muted/50 rounded text-sm">
                          <p className="text-xs text-muted-foreground mb-0.5">Previous admin note</p>
                          <p>{org.admin_notes}</p>
                        </div>
                      )}

                      {/* Admin actions (only for pending/more_info) */}
                      {(org.status === 'pending_approval' || org.status === 'more_info_needed') && (
                        <div className="space-y-3 border-t pt-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Approve as Tier</Label>
                              <Select
                                value={tiers[org.id] ?? '2'}
                                onValueChange={(v) => setTiers((p) => ({ ...p, [org.id]: v }))}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1">
                                    Tier 1 — Institutional (1 endorsement = active)
                                  </SelectItem>
                                  <SelectItem value="2">
                                    Tier 2 — Registered (2 endorsements = active)
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Note to organization (required for reject / more info)</Label>
                            <Textarea
                              rows={2}
                              placeholder="Provide reason or instructions…"
                              value={notes[org.id] ?? ''}
                              onChange={(e) => setNotes((p) => ({ ...p, [org.id]: e.target.value }))}
                            />
                          </div>

                          <div className="flex gap-2 flex-wrap">
                            <Button
                              size="sm"
                              className="gap-1.5 bg-success hover:bg-success/90"
                              disabled={acting === org.id}
                              onClick={() => handleAction(org, 'approve')}
                            >
                              {acting === org.id ? (
                                <Loader className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle className="w-3.5 h-3.5" />
                              )}
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                              disabled={acting === org.id}
                              onClick={() => handleAction(org, 'request_more_info')}
                            >
                              <AlertCircle className="w-3.5 h-3.5" />
                              Request More Info
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="gap-1.5"
                              disabled={acting === org.id}
                              onClick={() => handleAction(org, 'reject')}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Suspend active orgs */}
                      {org.status === 'active' && (
                        <div className="space-y-3 border-t pt-4">
                          <div className="space-y-1">
                            <Label className="text-xs">Suspension reason (required)</Label>
                            <Textarea
                              rows={2}
                              placeholder="Reason for suspension…"
                              value={notes[org.id] ?? ''}
                              onChange={(e) => setNotes((p) => ({ ...p, [org.id]: e.target.value }))}
                            />
                          </div>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="gap-1.5"
                            disabled={acting === org.id}
                            onClick={() => handleAction(org, 'suspend')}
                          >
                            {acting === org.id ? (
                              <Loader className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" />
                            )}
                            Suspend Organization
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

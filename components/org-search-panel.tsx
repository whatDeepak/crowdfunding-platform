'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Search, Building2, Globe, MapPin, Star, Send, Loader,
  CheckCircle, ChevronRight, ChevronLeft, Link2,
} from 'lucide-react';

export interface OrgSearchPanelProps {
  campaignId:      string;
  category:        string;
  orgs:            any[];
  orgLoading:      boolean;
  orgTotal:        number;
  orgPage:         number;
  orgTotalPages:   number;
  orgSearch:       string;
  orgTypeFilter:   string;
  geoFilter:       string;
  sentRequests:    Set<string>;
  requestNotes:    Record<string, string>;
  requestingOrg:   string | null;
  onSearch:        (q: string) => void;
  onOrgTypeChange: (t: string) => void;
  onGeoChange:     (g: string) => void;
  onPageChange:    (p: number) => void;
  onNoteChange:    (id: string, note: string) => void;
  onRequest:       (id: string) => void;
  onInvite:        () => void;
}

const ORG_TYPES = [
  { value: '',            label: 'All types' },
  { value: 'hospital',   label: 'Hospital / Clinic' },
  { value: 'ngo',        label: 'NGO' },
  { value: 'educational',label: 'University / College' },
  { value: 'pharmacy',   label: 'Pharmacy' },
  { value: 'legal',      label: 'Legal Aid' },
  { value: 'other',      label: 'Other' },
];

const GEO_SCOPES = [
  { value: '',              label: 'Any region' },
  { value: 'local',        label: 'Local' },
  { value: 'state',        label: 'State-wide' },
  { value: 'national',     label: 'National' },
  { value: 'international',label: 'International' },
];

export function OrgSearchPanel({
  campaignId, category, orgs, orgLoading, orgTotal, orgPage, orgTotalPages,
  orgSearch, orgTypeFilter, geoFilter, sentRequests, requestNotes, requestingOrg,
  onSearch, onOrgTypeChange, onGeoChange, onPageChange, onNoteChange, onRequest, onInvite,
}: OrgSearchPanelProps) {
  const [searchInput, setSearchInput] = useState(orgSearch);
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Find a registered trusted organization to endorse your{' '}
        <span className="capitalize font-medium">{category}</span> campaign.
        Tier 1 organizations activate your campaign with a single endorsement.
      </p>

      {/* Search input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, type, or registration…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch(searchInput)}
            className="pl-8"
          />
        </div>
        <Button variant="outline" onClick={() => onSearch(searchInput)} className="gap-2 shrink-0">
          <Search className="w-3.5 h-3.5" /> Search
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={orgTypeFilter}
          onChange={(e) => onOrgTypeChange(e.target.value)}
          className="text-sm border border-input rounded-md px-2.5 py-1.5 bg-background"
        >
          {ORG_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select
          value={geoFilter}
          onChange={(e) => onGeoChange(e.target.value)}
          className="text-sm border border-input rounded-md px-2.5 py-1.5 bg-background"
        >
          {GEO_SCOPES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
        <span className="text-xs text-muted-foreground ml-auto">
          {orgTotal} organization{orgTotal !== 1 ? 's' : ''} found
        </span>
      </div>

      {/* Results */}
      {orgLoading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
          <Loader className="w-4 h-4 animate-spin" /> Loading organizations…
        </div>
      ) : orgs.length === 0 ? (
        <div className="text-center py-10 space-y-3">
          <Building2 className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            No active organizations found{orgSearch ? ` for "${orgSearch}"` : ''}.
          </p>
          <p className="text-sm text-muted-foreground">
            You can invite an organization to register on the platform.
          </p>
          <Button variant="outline" onClick={onInvite} className="gap-2">
            <Link2 className="w-4 h-4" /> Copy Invite Link
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {orgs.map((org) => {
            const sent     = sentRequests.has(org.id);
            const expanded = expandedOrg === org.id;
            return (
              <Card
                key={org.id}
                className={`transition-all ${sent ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' : ''}`}
              >
                <div
                  className="flex items-start gap-3 p-4 cursor-pointer select-none"
                  onClick={() => setExpandedOrg(expanded ? null : org.id)}
                >
                  <Building2 className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm">{org.org_name}</span>
                      <Badge variant="outline" className="text-xs">Tier {org.tier}</Badge>
                      {org.tier === 1 && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                      {sent && <Badge className="text-xs bg-green-500 text-white">Request Sent</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                      <span className="capitalize">{org.org_type.replace('_', ' ')}</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />{org.geographic_scope}
                      </span>
                      <span className="flex items-center gap-1">
                        <Globe className="w-3 h-3" />{(org.domains as string[]).join(', ')}
                      </span>
                      {org.total_endorsements > 0 && (
                        <span>{org.total_endorsements} endorsement{org.total_endorsements !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                </div>

                {expanded && (
                  <div className="px-4 pb-4 border-t pt-3 space-y-3">
                    {org.responsible_person && (
                      <p className="text-xs text-muted-foreground">
                        Contact: {org.responsible_person}
                      </p>
                    )}
                    {org.website_url && (
                      <a
                        href={org.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <Globe className="w-3 h-3" />{org.website_url}
                      </a>
                    )}
                    {sent ? (
                      <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" /> Request sent! The organization will be notified.
                      </p>
                    ) : (
                      <>
                        <Textarea
                          placeholder="Optional note (explain your connection to this organization, why you're requesting them…)"
                          value={requestNotes[org.id] ?? ''}
                          onChange={(e) => onNoteChange(org.id, e.target.value)}
                          rows={2}
                          className="text-sm"
                        />
                        <Button
                          size="sm"
                          className="gap-2 w-full"
                          onClick={() => onRequest(org.id)}
                          disabled={requestingOrg === org.id}
                        >
                          {requestingOrg === org.id ? (
                            <><Loader className="w-3.5 h-3.5 animate-spin" /> Sending…</>
                          ) : (
                            <><Send className="w-3.5 h-3.5" /> Request Verification from {org.org_name}</>
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </Card>
            );
          })}

          {/* Pagination */}
          {orgTotalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline" size="sm"
                onClick={() => onPageChange(orgPage - 1)}
                disabled={orgPage <= 1}
                className="gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {orgPage} of {orgTotalPages}
              </span>
              <Button
                variant="outline" size="sm"
                onClick={() => onPageChange(orgPage + 1)}
                disabled={orgPage >= orgTotalPages}
                className="gap-1"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}

          {/* Invite section */}
          <div className="flex items-center gap-3 pt-2 border-t">
            <p className="text-sm text-muted-foreground flex-1">
              Can't find the right organization? Invite them to register.
            </p>
            <Button variant="outline" size="sm" onClick={onInvite} className="gap-2 shrink-0">
              <Link2 className="w-3.5 h-3.5" /> Copy Invite Link
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Card } from '@/components/ui/card';
import { CampaignCard, type CampaignCardData } from '@/components/campaign-card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Loader, Plus } from 'lucide-react';
import Link from 'next/link';
import type { CampaignCategory } from '@/lib/types';

const CATEGORIES: { value: CampaignCategory | 'all'; label: string }[] = [
  { value: 'all',       label: 'All Categories' },
  { value: 'medical',   label: 'Medical' },
  { value: 'education', label: 'Education' },
  { value: 'disaster',  label: 'Disaster Relief' },
  { value: 'community', label: 'Community' },
];

export default function CampaignsPage() {
  const [campaigns, setCampaigns]         = useState<CampaignCardData[]>([]);
  const [loading, setLoading]             = useState(true);
  const [searchQuery, setSearchQuery]     = useState('');
  const [category, setCategory]           = useState<CampaignCategory | 'all'>('all');
  const [searchDebounce, setSearchDebounce] = useState('');

  // Debounce the search input by 400ms
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounce(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '30' });
      if (searchDebounce) params.set('q', searchDebounce);
      if (category !== 'all') params.set('category', category);

      const res = await fetch(`/api/campaigns?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setCampaigns(data);
    } catch {
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, [searchDebounce, category]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="bg-gradient-to-b from-muted/50 to-background py-12">
          <div className="container mx-auto px-4 flex items-end justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">Explore Campaigns</h1>
              <p className="text-lg text-muted-foreground">
                AI-verified causes backed by blockchain-secured escrow
              </p>
            </div>
            <Button asChild>
              <Link href="/create-campaign">
                <Plus className="mr-2 h-4 w-4" />
                Start a Campaign
              </Link>
            </Button>
          </div>
        </div>

        <div className="container mx-auto px-4 py-10">
          <Card className="p-5 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search campaigns..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as CampaignCategory | 'all')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-24">
              <p className="text-muted-foreground text-lg mb-4">
                {searchDebounce || category !== 'all'
                  ? 'No campaigns match your filters.'
                  : 'No active campaigns yet.'}
              </p>
              <Button asChild>
                <Link href="/create-campaign">Start the First Campaign</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {campaigns.map((c) => (
                  <CampaignCard key={c.id} campaign={c} />
                ))}
              </div>
              <p className="text-center text-sm text-muted-foreground">
                {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} shown
              </p>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

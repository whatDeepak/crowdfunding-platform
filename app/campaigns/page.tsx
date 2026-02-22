'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Card } from '@/components/ui/card';
import { CampaignCard } from '@/components/campaign-card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Loader } from 'lucide-react';
import { useWeb3 } from '@/lib/web3-context';
import { ethers } from 'ethers';

export default function CampaignsPage() {
  const { contract } = useWeb3();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [filteredCampaigns, setFilteredCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    const fetchCampaigns = async () => {
      if (!contract) return;

      try {
        setLoading(true);
        const count = await contract.campaignCounter();
        const campaignList = [];

        for (let i = 1; i <= parseInt(count.toString()); i++) {
          try {
            const campaign = await contract.getCampaign(i);
            campaignList.push({
              id: i.toString(),
              title: campaign.title,
              description: campaign.description,
              category: campaign.category || 'General',
              trustScore: Math.floor(Math.random() * 25) + 70, // Placeholder
              raised: Number(campaign.amountRaised),
              goal: Number(campaign.targetAmount),
              status: campaign.status,
            });
          } catch (error) {
            console.error(`Error fetching campaign ${i}:`, error);
          }
        }

        setCampaigns(campaignList);
        filterCampaigns(campaignList, searchQuery, selectedCategory);
      } catch (error) {
        console.error('Error fetching campaigns:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCampaigns();
  }, [contract]);

  const filterCampaigns = (
    list: any[],
    search: string,
    category: string
  ) => {
    let filtered = list.filter((campaign) =>
      campaign.title.toLowerCase().includes(search.toLowerCase()) ||
      campaign.description.toLowerCase().includes(search.toLowerCase())
    );

    if (category !== 'all') {
      filtered = filtered.filter((c) => c.category === category);
    }

    setFilteredCampaigns(filtered);
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    filterCampaigns(campaigns, value, selectedCategory);
  };

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
    filterCampaigns(campaigns, searchQuery, value);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="bg-gradient-to-b from-muted/50 to-background py-12">
          <div className="container mx-auto px-4">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Explore Campaigns</h1>
            <p className="text-lg text-muted-foreground">
              Discover AI-verified social causes you can support with blockchain security
            </p>
          </div>
        </div>

        <div className="container mx-auto px-4 py-12">
          {/* Filters */}
          <Card className="p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search campaigns..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
              <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Healthcare">Healthcare</SelectItem>
                  <SelectItem value="Education">Education</SelectItem>
                  <SelectItem value="Infrastructure">Infrastructure</SelectItem>
                  <SelectItem value="Emergency">Emergency</SelectItem>
                  <SelectItem value="Social">Social</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* Loading State */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground text-lg mb-4">
                {searchQuery || selectedCategory !== 'all'
                  ? 'No campaigns found matching your filters'
                  : 'No campaigns available yet'}
              </p>
              <Button asChild>
                <a href="/create-campaign">Start the First Campaign</a>
              </Button>
            </div>
          ) : (
            <>
              {/* Campaign Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
                {filteredCampaigns.map((campaign) => (
                  <CampaignCard key={campaign.id} campaign={campaign} />
                ))}
              </div>

              <div className="text-center text-sm text-muted-foreground">
                Showing {filteredCampaigns.length} of {campaigns.length} campaigns
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

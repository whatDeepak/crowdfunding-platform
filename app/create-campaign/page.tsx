'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { useWeb3 } from '@/lib/web3-context';
import { createCampaignMetadata } from '@/lib/supabase';
import { toast } from 'sonner';
import { Loader, AlertCircle, CheckCircle } from 'lucide-react';

export default function CreateCampaignPage() {
  const router = useRouter();
  const { contract, account, isConnected } = useWeb3();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    targetAmount: '',
    durationDays: '30',
    category: 'General',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!formData.title || !formData.description || !formData.targetAmount) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      toast.loading('Creating campaign...');

      // Convert target amount to wei
      const targetAmountWei = (parseFloat(formData.targetAmount) * 1e18).toString();

      // Create campaign on blockchain
      const tx = await contract?.createCampaign(
        formData.title,
        formData.description,
        targetAmountWei,
        parseInt(formData.durationDays),
        'QmExample' // Placeholder IPFS hash
      );

      toast.loading('Waiting for confirmation...');
      const receipt = await tx.wait();

      // Get the campaign ID from the contract
      const campaignCount = await contract?.campaignCounter();
      const campaignId = parseInt(campaignCount.toString());

      // Store metadata in Supabase
      await createCampaignMetadata(campaignId, {
        creator_address: account,
        title: formData.title,
        description: formData.description,
        category: formData.category,
        target_amount: formData.targetAmount,
        visible: true,
      });

      toast.success('Campaign created successfully!');
      router.push(`/campaigns/${campaignId}`);
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast.error('Failed to create campaign');
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-12">
          <div className="max-w-2xl mx-auto">
            <div className="text-center py-20">
              <AlertCircle className="w-12 h-12 text-warning mx-auto mb-4" />
              <h1 className="text-2xl font-bold mb-2">Connect Your Wallet</h1>
              <p className="text-muted-foreground mb-4">
                You need to connect your wallet to create a campaign
              </p>
            </div>
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
        <div className="bg-gradient-to-b from-muted/50 to-background py-12">
          <div className="container mx-auto px-4">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Create a Campaign</h1>
            <p className="text-lg text-muted-foreground">
              Start a verified crowdfunding campaign on the blockchain
            </p>
          </div>
        </div>

        <div className="container mx-auto px-4 py-12">
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Campaign Details</CardTitle>
                <CardDescription>
                  Provide information about your campaign. Your campaign will go through AI verification.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="title">Campaign Title *</Label>
                    <Input
                      id="title"
                      name="title"
                      placeholder="e.g., Medical Treatment for Rural Children"
                      value={formData.title}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description *</Label>
                    <Textarea
                      id="description"
                      name="description"
                      placeholder="Describe your campaign in detail. Be specific about your goals, target beneficiaries, and how you'll use the funds."
                      value={formData.description}
                      onChange={handleChange}
                      rows={6}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="targetAmount">Target Amount (ETH) *</Label>
                      <Input
                        id="targetAmount"
                        name="targetAmount"
                        type="number"
                        placeholder="e.g., 2.5"
                        value={formData.targetAmount}
                        onChange={handleChange}
                        step="0.1"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="durationDays">Duration (Days) *</Label>
                      <Input
                        id="durationDays"
                        name="durationDays"
                        type="number"
                        placeholder="30"
                        value={formData.durationDays}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <select
                      id="category"
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
                    >
                      <option>General</option>
                      <option>Healthcare</option>
                      <option>Education</option>
                      <option>Infrastructure</option>
                      <option>Emergency</option>
                      <option>Environment</option>
                      <option>Social</option>
                    </select>
                  </div>

                  <Alert className="bg-info/10 border-info">
                    <CheckCircle className="w-4 h-4" />
                    <AlertDescription>
                      Your campaign will be analyzed by our AI system to verify legitimacy and detect suspicious content
                      before being published.
                    </AlertDescription>
                  </Alert>

                  <div className="flex gap-4">
                    <Button
                      type="submit"
                      disabled={loading}
                      className="flex-1"
                    >
                      {loading ? (
                        <>
                          <Loader className="w-4 h-4 mr-2 animate-spin" />
                          Creating Campaign...
                        </>
                      ) : (
                        'Create Campaign'
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.back()}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

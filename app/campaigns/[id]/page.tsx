'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shield, Check, FileText, ExternalLink, Wallet, Vote, AlertCircle, Loader } from "lucide-react"
import { useWeb3 } from '@/lib/web3-context';
import { toast } from 'sonner';
import { ethers } from 'ethers';

export default function CampaignDetailPage() {
  const params = useParams();
  const campaignId = params.id as string;
  const { contract, account, isConnected } = useWeb3();
  const [campaign, setCampaign] = useState<any>(null);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [donors, setDonors] = useState<any[]>([]);
  const [donationAmount, setDonationAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [donating, setDonating] = useState(false);

  useEffect(() => {
    const fetchCampaignDetails = async () => {
      if (!contract || !campaignId) return;

      try {
        setLoading(true);
        const campaignData = await contract.getCampaign(campaignId);
        const milestonesData = await contract.getCampaignMilestones(campaignId);
        const donorsData = await contract.getCampaignDonations(campaignId);

        setCampaign({
          id: campaignId,
          ...campaignData,
        });

        setMilestones(milestonesData || []);
        setDonors(donorsData || []);
      } catch (error) {
        console.error('Error fetching campaign details:', error);
        toast.error('Failed to load campaign details');
      } finally {
        setLoading(false);
      }
    };

    fetchCampaignDetails();
  }, [contract, campaignId]);

  const handleDonate = async () => {
    if (!isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!donationAmount || parseFloat(donationAmount) <= 0) {
      toast.error('Please enter a valid donation amount');
      return;
    }

    try {
      setDonating(true);
      toast.loading('Processing donation...');
      const amountInWei = ethers.parseEther(donationAmount);
      const tx = await contract?.donate(campaignId, {
        value: amountInWei,
      });

      const receipt = await tx.wait();
      toast.success('Donation successful!');
      setDonationAmount('');

      const updatedCampaign = await contract?.getCampaign(campaignId);
      const updatedDonors = await contract?.getCampaignDonations(campaignId);
      setCampaign({
        id: campaignId,
        ...updatedCampaign,
      });
      setDonors(updatedDonors || []);
    } catch (error) {
      console.error('Error donating:', error);
      toast.error('Failed to process donation');
    } finally {
      setDonating(false);
    }
  };

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
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Campaign Not Found</h1>
            <p className="text-muted-foreground mb-4">The campaign you're looking for doesn't exist.</p>
            <Button asChild>
              <a href="/campaigns">Back to Campaigns</a>
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const isCreator = account?.toLowerCase() === campaign.creator.toLowerCase();
  const progressPercentage = (Number(campaign.amountRaised) / Number(campaign.targetAmount)) * 100;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="secondary">General</Badge>
                  <Badge className="bg-success text-success-foreground">Trust Score: 75</Badge>
                </div>
                <h1 className="text-3xl font-bold mb-4 text-balance">{campaign.title}</h1>
                <p className="text-lg text-muted-foreground leading-relaxed">{campaign.description}</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-4">
                  <div className="text-sm text-muted-foreground mb-1">Donors</div>
                  <div className="text-2xl font-bold">{donors.length}</div>
                </Card>
                <Card className="p-4">
                  <div className="text-sm text-muted-foreground mb-1">Days Left</div>
                  <div className="text-2xl font-bold">
                    {Math.max(0, Math.floor((Number(campaign.deadline) - Date.now() / 1000) / 86400))}
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-sm text-muted-foreground mb-1">Milestones</div>
                  <div className="text-2xl font-bold">{milestones.length}</div>
                </Card>
              </div>

              {/* Tabs */}
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="milestones">Milestones</TabsTrigger>
                  <TabsTrigger value="donors">Donors</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4 mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Campaign Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Creator</p>
                          <code className="text-sm bg-muted px-2 py-1 rounded">
                            {campaign.creator.slice(0, 6)}...{campaign.creator.slice(-4)}
                          </code>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Created</p>
                          <p className="text-sm">
                            {new Date(Number(campaign.createdAt) * 1000).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {isCreator && (
                        <Alert className="bg-primary/10 border-primary">
                          <AlertDescription>You are the creator of this campaign</AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="milestones" className="space-y-4 mt-6">
                  {milestones.length === 0 ? (
                    <Alert>
                      <AlertDescription>No milestones set yet</AlertDescription>
                    </Alert>
                  ) : (
                    milestones.map((milestone, idx) => (
                      <Card key={idx}>
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-lg">{milestone.title}</CardTitle>
                              <CardDescription>{milestone.description}</CardDescription>
                            </div>
                            <Badge>{milestone.status}</Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground">
                            Release: {(Number(milestone.releaseAmount) / 1e18).toFixed(2)} ETH
                          </p>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="donors" className="space-y-4 mt-6">
                  {donors.length === 0 ? (
                    <Alert>
                      <AlertDescription>No donations yet</AlertDescription>
                    </Alert>
                  ) : (
                    donors.map((donor, idx) => (
                      <Card key={idx} className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <code className="text-sm">
                              {donor.donor.slice(0, 6)}...{donor.donor.slice(-4)}
                            </code>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(Number(donor.timestamp) * 1000).toLocaleDateString()}
                            </p>
                          </div>
                          <p className="font-semibold">
                            {(Number(donor.amount) / 1e18).toFixed(2)} ETH
                          </p>
                        </div>
                      </Card>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </div>

            {/* Sidebar - Donation Card */}
            <div className="lg:col-span-1">
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle>Support This Campaign</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-2xl font-bold">
                        {(Number(campaign.amountRaised) / 1e18).toFixed(2)} ETH
                      </span>
                      <span className="text-muted-foreground">
                        of {(Number(campaign.targetAmount) / 1e18).toFixed(2)} ETH
                      </span>
                    </div>
                    <Progress value={Math.min(progressPercentage, 100)} className="h-2" />
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{progressPercentage.toFixed(1)}% funded</span>
                      <span>{donors.length} donors</span>
                    </div>
                  </div>

                  {!isConnected && (
                    <Alert className="bg-warning/10 border-warning">
                      <AlertCircle className="w-4 h-4" />
                      <AlertDescription>
                        Please connect your wallet to donate
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-3">
                    <label className="text-sm font-medium">Donation Amount (ETH)</label>
                    <Input
                      type="number"
                      placeholder="0.1"
                      value={donationAmount}
                      onChange={(e) => setDonationAmount(e.target.value)}
                      disabled={!isConnected || donating}
                      step="0.01"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      {[0.1, 0.5, 1].map((amount) => (
                        <Button
                          key={amount}
                          variant="outline"
                          size="sm"
                          onClick={() => setDonationAmount(amount.toString())}
                          disabled={!isConnected}
                        >
                          {amount} ETH
                        </Button>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={handleDonate}
                    disabled={!isConnected || donating || !donationAmount}
                    size="lg"
                    className="w-full gap-2"
                  >
                    {donating ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Wallet className="h-4 w-4" />
                        Donate Now
                      </>
                    )}
                  </Button>

                  {campaign.amountRaised >= campaign.targetAmount && (
                    <Alert className="bg-success/10 border-success">
                      <Check className="w-4 h-4" />
                      <AlertDescription>
                        This campaign has reached its goal!
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="pt-4 border-t space-y-2 text-xs text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <Shield className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                      <p>Your donation is secured in a smart contract until milestones are verified</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
                      <p>You'll vote on milestone completion before funds are released</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

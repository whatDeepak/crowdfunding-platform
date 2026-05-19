import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CampaignCard } from "@/components/campaign-card"

const campaigns = [
  {
    id: "1",
    title: "Medical Treatment for Rural Children",
    category: "medical",
    ai_trust_score: 92,
    current_amount_eth: 2.1,
    target_amount_eth: 3.5,
    status: "active",
    image_url: null,
    description: "Providing essential medical care to underserved children in rural communities",
  },
  {
    id: "2",
    title: "Clean Water Infrastructure Project",
    category: "community",
    ai_trust_score: 88,
    current_amount_eth: 4.8,
    target_amount_eth: 8.0,
    status: "active",
    image_url: null,
    description: "Building sustainable water systems for villages without clean water access",
  },
  {
    id: "3",
    title: "Education Support for Underprivileged Students",
    category: "education",
    ai_trust_score: 95,
    current_amount_eth: 1.8,
    target_amount_eth: 2.4,
    status: "active",
    image_url: null,
    description: "Scholarships and learning materials for students from low-income families",
  },
]

export function FeaturedCampaigns() {
  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">Active Verified Campaigns</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            All campaigns have passed AI verification and are secured with blockchain escrow
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {campaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>

        <div className="text-center">
          <Button size="lg" variant="outline" asChild>
            <Link href="/campaigns">View All Campaigns</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

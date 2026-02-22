import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CampaignCard } from "@/components/campaign-card"

const campaigns = [
  {
    id: "1",
    title: "Medical Treatment for Rural Children",
    category: "Healthcare",
    trustScore: 92,
    raised: 45000,
    goal: 75000,
    description: "Providing essential medical care to underserved children in rural communities",
  },
  {
    id: "2",
    title: "Clean Water Infrastructure Project",
    category: "Infrastructure",
    trustScore: 88,
    raised: 120000,
    goal: 200000,
    description: "Building sustainable water systems for villages without clean water access",
  },
  {
    id: "3",
    title: "Education Support for Underprivileged Students",
    category: "Education",
    trustScore: 95,
    raised: 60000,
    goal: 80000,
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

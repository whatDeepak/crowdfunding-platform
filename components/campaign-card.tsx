import Link from "next/link"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ArrowRight } from "lucide-react"

interface Campaign {
  id: string
  title: string
  category: string
  trustScore: number
  raised: number
  goal: number
  description: string
}

interface CampaignCardProps {
  campaign: Campaign
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const percentage = (campaign.raised / campaign.goal) * 100

  const getTrustScoreColor = (score: number) => {
    if (score >= 90) return "bg-success text-success-foreground"
    if (score >= 75) return "bg-warning text-warning-foreground"
    return "bg-destructive text-destructive-foreground"
  }

  return (
    <Card className="flex flex-col h-full hover:shadow-lg transition-shadow">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <Badge variant="secondary" className="text-xs">
            {campaign.category}
          </Badge>
          <Badge className={getTrustScoreColor(campaign.trustScore)}>Trust Score: {campaign.trustScore}</Badge>
        </div>
        <h3 className="text-xl font-semibold text-balance leading-tight">{campaign.title}</h3>
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">{campaign.description}</p>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{(campaign.raised / 1e18).toFixed(2)} ETH</span>
            <span className="text-muted-foreground">of {(campaign.goal / 1e18).toFixed(2)} ETH</span>
          </div>
          <Progress value={percentage} className="h-2" />
          <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}% funded</p>
        </div>
      </CardContent>

      <CardFooter>
        <Button asChild className="w-full">
          <Link href={`/campaigns/${campaign.id}`}>
            View Details
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

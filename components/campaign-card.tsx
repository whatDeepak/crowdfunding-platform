import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowRight, ShieldCheck } from 'lucide-react';

export interface CampaignCardData {
  id: string;
  title: string;
  description: string;
  category: string;
  ai_trust_score: number | null;
  current_amount_eth: number;
  target_amount_eth: number;
  status: string;
  image_url: string | null;
  endorsement_count?: number;
}

interface CampaignCardProps {
  campaign: CampaignCardData;
}

function trustBadgeClass(score: number | null) {
  if (score === null) return 'bg-muted text-muted-foreground';
  if (score >= 70) return 'bg-success text-success-foreground';
  if (score >= 40) return 'bg-warning text-warning-foreground';
  return 'bg-destructive text-destructive-foreground';
}

function categoryLabel(cat: string) {
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const pct = campaign.target_amount_eth > 0
    ? Math.min((campaign.current_amount_eth / campaign.target_amount_eth) * 100, 100)
    : 0;

  return (
    <Card className="flex flex-col h-full hover:shadow-lg transition-shadow">
      {campaign.image_url && (
        <div className="h-40 overflow-hidden rounded-t-lg">
          <img
            src={campaign.image_url}
            alt={campaign.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <CardHeader className="space-y-2 pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs">
            {categoryLabel(campaign.category)}
          </Badge>
          <div className="flex items-center gap-1.5">
            {(campaign.endorsement_count ?? 0) > 0 && (
              <ShieldCheck className="h-4 w-4 text-success" aria-label="Verified by trusted organization" />
            )}
            <Badge className={trustBadgeClass(campaign.ai_trust_score)}>
              {campaign.ai_trust_score !== null ? `Trust: ${campaign.ai_trust_score}` : 'Unscored'}
            </Badge>
          </div>
        </div>
        <h3 className="text-lg font-semibold leading-tight text-balance line-clamp-2">
          {campaign.title}
        </h3>
      </CardHeader>

      <CardContent className="flex-1 space-y-4 pt-0">
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
          {campaign.description}
        </p>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{campaign.current_amount_eth.toFixed(3)} ETH</span>
            <span className="text-muted-foreground">of {campaign.target_amount_eth.toFixed(2)} ETH</span>
          </div>
          <Progress value={pct} className="h-2" />
          <p className="text-xs text-muted-foreground">{pct.toFixed(1)}% funded</p>
        </div>
      </CardContent>

      <CardFooter className="pt-2">
        <Button asChild className="w-full">
          <Link href={`/campaigns/${campaign.id}`}>
            View Details
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

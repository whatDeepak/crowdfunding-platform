import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Shield } from "lucide-react"

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-background to-muted/30 py-20 md:py-32">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary">
            <Shield className="h-4 w-4" />
            Blockchain-Secured Platform
          </div>

          <h1 className="mb-6 text-balance text-5xl font-bold tracking-tight md:text-6xl lg:text-7xl">
            Transparent, AI-Verified Crowdfunding for Social Causes
          </h1>

          <p className="mb-10 text-pretty text-lg text-muted-foreground md:text-xl leading-relaxed max-w-3xl mx-auto">
            Every campaign verified. Every donation tracked. Every rupee accountable.
            <br />
            Trust infrastructure built on AI verification, blockchain escrow, and DAO governance.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" asChild className="w-full sm:w-auto">
              <Link href="/campaigns">
                View Verified Campaigns
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="w-full sm:w-auto bg-transparent">
              <Link href="#how-it-works">How Trust Works</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

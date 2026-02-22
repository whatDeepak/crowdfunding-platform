import { Header } from "@/components/header"
import { Hero } from "@/components/hero"
import { TrustIndicators } from "@/components/trust-indicators"
import { FeaturedCampaigns } from "@/components/featured-campaigns"
import { HowItWorks } from "@/components/how-it-works"
import { Footer } from "@/components/footer"

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <TrustIndicators />
        <FeaturedCampaigns />
        <HowItWorks />
      </main>
      <Footer />
    </div>
  )
}

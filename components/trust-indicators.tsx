import { Shield, Lock, Users, Database } from "lucide-react"

const indicators = [
  {
    icon: Shield,
    title: "AI-Verified Campaigns",
    description: "NLP and image verification for every campaign submission",
  },
  {
    icon: Lock,
    title: "Blockchain Escrow",
    description: "Funds secured in smart contracts until milestones are met",
  },
  {
    icon: Users,
    title: "DAO-Based Fund Release",
    description: "Donors vote on milestone approval for full transparency",
  },
  {
    icon: Database,
    title: "Immutable Proof Storage",
    description: "All documents stored on IPFS for permanent verification",
  },
]

export function TrustIndicators() {
  return (
    <section className="py-16 bg-card border-y border-border">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {indicators.map((indicator) => (
            <div key={indicator.title} className="flex flex-col items-center text-center gap-3">
              <div className="rounded-lg bg-primary/10 p-3">
                <indicator.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">{indicator.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{indicator.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

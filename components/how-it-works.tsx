import { FileCheck, Shield, Lock, Vote, CheckCircle } from "lucide-react"

const steps = [
  {
    icon: FileCheck,
    number: "1",
    title: "Campaign Creation",
    description: "Organizers submit campaigns with detailed documentation and proof",
  },
  {
    icon: Shield,
    number: "2",
    title: "AI Verification",
    description: "Our AI analyzes content, images, and documents for authenticity",
  },
  {
    icon: Lock,
    number: "3",
    title: "Smart Contract Escrow",
    description: "Approved campaigns receive donations secured in blockchain escrow",
  },
  {
    icon: Vote,
    number: "4",
    title: "Donor Voting",
    description: "Donors vote on milestone completion before fund release",
  },
  {
    icon: CheckCircle,
    number: "5",
    title: "Fund Release",
    description: "Funds are released automatically when milestones are approved",
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">How the Platform Works</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A transparent, secure process from campaign creation to fund distribution
          </p>
        </div>

        <div className="relative max-w-5xl mx-auto">
          {/* Connection line */}
          <div
            className="hidden lg:block absolute top-20 left-0 right-0 h-0.5 bg-border"
            style={{ left: "10%", right: "10%" }}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-8">
            {steps.map((step) => (
              <div key={step.number} className="relative flex flex-col items-center text-center">
                <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xl shadow-lg z-10">
                  {step.number}
                </div>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <step.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold text-foreground">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

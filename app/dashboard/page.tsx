import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowRight, Wallet, TrendingUp, Vote, Activity } from "lucide-react"
import Link from "next/link"

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your impact overview.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Donated</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹1,24,500</div>
              <p className="text-xs text-muted-foreground mt-1">Across 8 campaigns</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Campaigns</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">8</div>
              <p className="text-xs text-muted-foreground mt-1">Supporting currently</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Votes</CardTitle>
              <Vote className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3</div>
              <p className="text-xs text-muted-foreground mt-1">Milestones awaiting approval</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Wallet Balance</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0.45 ETH</div>
              <p className="text-xs text-muted-foreground mt-1">≈ ₹85,000</p>
            </CardContent>
          </Card>
        </div>

        {/* My Donations */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Donations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                {
                  campaign: "Medical Treatment for Rural Children",
                  amount: 25000,
                  date: "2024-01-15",
                  status: "Active",
                },
                { campaign: "Clean Water Infrastructure", amount: 50000, date: "2024-01-10", status: "Active" },
                { campaign: "Education Support Program", amount: 15000, date: "2024-01-05", status: "Completed" },
              ].map((donation, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b last:border-0">
                  <div className="flex-1">
                    <p className="font-medium">{donation.campaign}</p>
                    <p className="text-sm text-muted-foreground">Donated on {donation.date}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold">₹{donation.amount.toLocaleString()}</p>
                      <Badge variant={donation.status === "Active" ? "default" : "secondary"} className="text-xs">
                        {donation.status}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/campaigns/${i + 1}`}>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pending Votes */}
        <Card>
          <CardHeader>
            <CardTitle>Milestones Awaiting Your Vote</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {[
                {
                  campaign: "Medical Treatment for Rural Children",
                  milestone: "Phase 1: Initial Treatment",
                  proof: "Medical bills and progress reports",
                  deadline: "2 days",
                },
                {
                  campaign: "Clean Water Infrastructure",
                  milestone: "Well Construction Complete",
                  proof: "Construction photos and inspection report",
                  deadline: "5 days",
                },
              ].map((vote, i) => (
                <div key={i} className="p-4 border rounded-lg space-y-3">
                  <div>
                    <h4 className="font-semibold mb-1">{vote.campaign}</h4>
                    <p className="text-sm text-muted-foreground">{vote.milestone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      Proof Uploaded
                    </Badge>
                    <span className="text-xs text-muted-foreground">• {vote.proof}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Voting ends in {vote.deadline}</span>
                    <div className="flex gap-2">
                      <Button variant="destructive" size="sm">
                        Reject
                      </Button>
                      <Button size="sm">Approve</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Shield, LayoutDashboard, Search, Heart, Activity,
  LogOut, Wallet, Settings, ShieldCheck,
} from 'lucide-react';
import { useWeb3 } from '@/lib/web3-context';

interface DashboardLayoutProps {
  children: ReactNode;
}

function NavLink({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  const pathname = usePathname();
  const active   = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors
        ${active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
    >
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { account, isConnected, isAdmin, disconnectWallet } = useWeb3();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="text-xl font-semibold">TrustFund</span>
          </Link>

          <div className="flex items-center gap-3">
            {isConnected && account && (
              <div className="text-sm text-muted-foreground hidden sm:block">
                <Wallet className="inline h-4 w-4 mr-1" />
                {account.slice(0, 6)}…{account.slice(-4)}
              </div>
            )}
            {isAdmin && (
              <Link href="/admin">
                <Button variant="outline" size="sm" className="gap-2">
                  <Settings className="h-4 w-4" /> Admin
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="sticky top-16 h-[calc(100vh-4rem)] w-60 border-r border-border bg-card p-4 hidden lg:block">
          <nav className="space-y-1">
            <NavLink href="/dashboard"    icon={LayoutDashboard} label="Overview" />
            <NavLink href="/campaigns"    icon={Search}          label="Explore Campaigns" />
            <NavLink href="/dashboard/donations" icon={Heart}   label="My Donations" />
            <NavLink href="/dashboard/my-campaigns" icon={Activity} label="My Campaigns" />

            {isAdmin && (
              <>
                <div className="pt-4 mt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground px-3 mb-2 uppercase tracking-wider">Admin</p>
                  <NavLink href="/admin/campaigns"   icon={ShieldCheck} label="Review Campaigns" />
                  <NavLink href="/admin/withdrawals" icon={Settings}    label="Withdrawals" />
                </div>
              </>
            )}

            <div className="pt-4 mt-4 border-t border-border">
              <NavLink href="/verify" icon={ShieldCheck} label="Verifier Queue" />
              <button
                onClick={disconnectWallet}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <LogOut className="h-5 w-5" />
                Disconnect
              </button>
            </div>
          </nav>
        </aside>

        <main className="flex-1 p-6 lg:p-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

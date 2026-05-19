'use client';

import Link from 'next/link';
import { useWeb3 } from '@/lib/web3-context';
import { Button } from '@/components/ui/button';
import { Shield, Wallet, Menu, X, LayoutDashboard, Settings, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

export function Header() {
  const { account, isConnected, isAdmin, connectWallet, balance, loading } = useWeb3();
  const [mobileOpen, setMobileOpen] = useState(false);

  const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
  const shortBal  = (b: string) => {
    try { return parseFloat(b).toFixed(3); } catch { return '0.000'; }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <Shield className="h-6 w-6 text-primary" />
          <span className="text-xl font-semibold">TrustFund</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-5 text-sm font-medium">
          <Link href="/campaigns"    className="text-foreground/80 hover:text-foreground transition-colors">
            Explore
          </Link>
          <Link href="/verify"       className="text-foreground/80 hover:text-foreground transition-colors flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Verify
          </Link>
          {isConnected && (
            <Link href="/dashboard"  className="text-foreground/80 hover:text-foreground transition-colors flex items-center gap-1">
              <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
            </Link>
          )}
          {isAdmin && (
            <Link href="/admin"      className="text-foreground/80 hover:text-foreground transition-colors flex items-center gap-1">
              <Settings className="w-3.5 h-3.5" /> Admin
            </Link>
          )}
        </nav>

        {/* Desktop wallet */}
        <div className="hidden md:flex items-center gap-3">
          {isConnected ? (
            <>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg text-xs">
                <Wallet className="w-3.5 h-3.5 text-primary" />
                <span className="font-medium">{shortAddr(account!)}</span>
                <span className="text-muted-foreground">·</span>
                <span>{shortBal(balance ?? '0')} ETH</span>
              </div>
              <Button asChild size="sm">
                <Link href="/create-campaign">Start Campaign</Link>
              </Button>
            </>
          ) : (
            <Button onClick={connectWallet} disabled={loading} size="sm" className="gap-2">
              <Wallet className="w-4 h-4" />
              {loading ? 'Connecting…' : 'Connect Wallet'}
            </Button>
          )}
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden p-2" onClick={() => setMobileOpen((o) => !o)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-card">
          <div className="container mx-auto px-4 py-3 space-y-1">
            {[
              { href: '/campaigns',  label: 'Explore Campaigns' },
              { href: '/verify',     label: 'Verifier Queue' },
              ...(isConnected ? [{ href: '/dashboard', label: 'Dashboard' }] : []),
              ...(isAdmin      ? [{ href: '/admin',     label: 'Admin Panel' }] : []),
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
              >
                {label}
              </Link>
            ))}

            <div className="pt-2 border-t border-border">
              {isConnected ? (
                <div className="space-y-2">
                  <div className="px-3 py-2 bg-muted rounded-lg text-xs">
                    <p className="font-medium">{shortAddr(account!)}</p>
                    <p className="text-muted-foreground">{shortBal(balance ?? '0')} ETH</p>
                  </div>
                  <Button className="w-full" size="sm" asChild>
                    <Link href="/create-campaign" onClick={() => setMobileOpen(false)}>
                      Start Campaign
                    </Link>
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => { connectWallet(); setMobileOpen(false); }}
                  disabled={loading}
                  className="w-full gap-2"
                  size="sm"
                >
                  <Wallet className="w-4 h-4" />
                  {loading ? 'Connecting…' : 'Connect Wallet'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

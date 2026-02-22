'use client';

import Link from 'next/link';
import { useWeb3 } from '@/lib/web3-context';
import { Button } from '@/components/ui/button';
import { Shield, Wallet, Menu, X } from 'lucide-react';
import { useState } from 'react';

export function Header() {
  const { account, isConnected, connectWallet, balance, loading } = useWeb3();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatBalance = (balance: string) => {
    try {
      const num = parseFloat(balance);
      return num.toFixed(2);
    } catch {
      return '0.00';
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <span className="text-xl font-semibold">TrustFund</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <Link
            href="/campaigns"
            className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
          >
            Explore Campaigns
          </Link>
          <Link
            href="/how-it-works"
            className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
          >
            How It Works
          </Link>
          <Link
            href="/transparency"
            className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
          >
            Transparency
          </Link>
          <Link
            href="/about"
            className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
          >
            About
          </Link>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {isConnected ? (
            <>
              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
                <Wallet className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium">{formatAddress(account!)}</span>
                <span className="text-xs text-muted-foreground">|</span>
                <span className="text-xs font-medium">{formatBalance(balance!)} ETH</span>
              </div>
              <Button asChild className="bg-primary hover:bg-primary/90">
                <Link href="/create-campaign">Start Campaign</Link>
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={connectWallet}
                disabled={loading}
                className="gap-2 bg-primary hover:bg-primary/90"
              >
                <Wallet className="w-4 h-4" />
                {loading ? 'Connecting...' : 'Connect Wallet'}
              </Button>
            </>
          )}
        </div>

        {/* Mobile Menu */}
        <button
          className="md:hidden p-2"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-card">
          <div className="container mx-auto px-4 py-3 space-y-2">
            <Link
              href="/campaigns"
              className="block px-3 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
            >
              Explore Campaigns
            </Link>
            <Link
              href="/how-it-works"
              className="block px-3 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
            >
              How It Works
            </Link>
            <Link
              href="/transparency"
              className="block px-3 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
            >
              Transparency
            </Link>
            <Link
              href="/about"
              className="block px-3 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
            >
              About
            </Link>
            <div className="pt-2 border-t border-border">
              {isConnected ? (
                <>
                  <Button className="w-full bg-primary hover:bg-primary/90 mb-2" asChild>
                    <Link href="/create-campaign">Start Campaign</Link>
                  </Button>
                  <div className="px-3 py-2 bg-muted rounded-lg text-xs">
                    <div className="font-medium">{formatAddress(account!)}</div>
                    <div className="text-muted-foreground">{formatBalance(balance!)} ETH</div>
                  </div>
                </>
              ) : (
                <Button
                  onClick={connectWallet}
                  disabled={loading}
                  className="w-full gap-2 bg-primary hover:bg-primary/90"
                >
                  <Wallet className="w-4 h-4" />
                  {loading ? 'Connecting...' : 'Connect Wallet'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

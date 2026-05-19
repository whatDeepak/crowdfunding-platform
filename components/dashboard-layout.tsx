'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Shield, LayoutDashboard, Search, Heart, Activity,
  LogOut, Wallet, Settings, ShieldCheck, Copy, RefreshCw, WalletMinimal, X,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useWeb3 } from '@/lib/web3-context';
import { useAuth } from '@/lib/auth-context';

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
  const { account, isConnected, connectWallet, disconnectWallet, balance, loading: walletLoading } = useWeb3();
  const { isAdmin, isVerifier, signOut, dbUser, user } = useAuth();

  const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
  const shortBal  = (b: string) => { try { return parseFloat(b).toFixed(3); } catch { return '0.000'; } };

  function copyAddress() {
    if (!account) return;
    navigator.clipboard.writeText(account);
    toast.success('Address copied');
  }

  async function switchAccount() {
    const eth = (window as any).ethereum;
    if (!eth) return;
    try {
      await eth.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] });
    } catch { /* user cancelled */ }
  }

  async function handleSaveWallet() {
    if (!account || !user) return;
    try {
      const res = await fetch('/api/user/wallet', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet_address: account }),
      });
      if (res.ok) toast.success('Wallet saved to your profile');
      else toast.error('Failed to save wallet');
    } catch {
      toast.error('Failed to save wallet');
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="text-xl font-semibold">TrustFund</span>
          </Link>

          <div className="flex items-center gap-3">
            {isConnected && account ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted hover:bg-muted/70 rounded-lg text-xs transition-colors cursor-pointer">
                    <Wallet className="w-3 h-3 text-primary" />
                    <span className="font-medium">{shortAddr(account)}</span>
                    <span className="text-muted-foreground">·</span>
                    <span>{shortBal(balance ?? '0')} ETH</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground break-all">
                    {account}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={copyAddress} className="gap-2">
                    <Copy className="w-3.5 h-3.5" /> Copy address
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={switchAccount} className="gap-2">
                    <RefreshCw className="w-3.5 h-3.5" /> Switch account
                  </DropdownMenuItem>
                  {user && dbUser?.wallet_address !== account && (
                    <DropdownMenuItem onClick={handleSaveWallet} className="gap-2">
                      <WalletMinimal className="w-3.5 h-3.5" /> Save to profile
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={disconnectWallet} className="gap-2 text-destructive focus:text-destructive">
                    <X className="w-3.5 h-3.5" /> Disconnect
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="outline" size="sm" className="gap-2" onClick={connectWallet} disabled={walletLoading}>
                <Wallet className="w-3.5 h-3.5" />
                {walletLoading ? 'Connecting…' : 'Connect Wallet'}
              </Button>
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

            {(isVerifier || isAdmin) && (
              <div className="pt-4 mt-4 border-t border-border">
                <NavLink href="/verify" icon={ShieldCheck} label="Verifier Queue" />
              </div>
            )}

            <div className="pt-4 mt-4 border-t border-border">
              <button
                onClick={signOut}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <LogOut className="h-5 w-5" />
                Sign Out
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

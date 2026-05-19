'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWeb3 } from '@/lib/web3-context';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Shield, Wallet, Menu, X, LayoutDashboard, Settings, ShieldCheck, LogOut, LogIn, User, Building2, Copy, RefreshCw, WalletMinimal } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function Header() {
  const { account, isConnected, connectWallet, disconnectWallet, balance, loading: walletLoading } = useWeb3();
  const { user, dbUser, isAdmin, isVerifier, signOut, loading: authLoading } = useAuth();
  const router     = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
  const shortBal  = (b: string) => { try { return parseFloat(b).toFixed(3); } catch { return '0.000'; } };
  const displayName = dbUser?.full_name ?? user?.email?.split('@')[0] ?? 'Account';

  async function handleSignOut() {
    await signOut();
    router.push('/');
  }

  function copyAddress() {
    if (!account) return;
    navigator.clipboard.writeText(account);
    toast.success('Address copied');
  }

  async function switchAccount() {
    const eth = (window as any).ethereum;
    if (!eth) return;
    try {
      await eth.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }],
      });
    } catch {
      // user cancelled
    }
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

  const navLinks = [
    { href: '/campaigns', label: 'Explore' },
    ...(isVerifier || isAdmin ? [{ href: '/verify', label: 'Verify', icon: ShieldCheck }] : []),
    ...(user ? [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }] : []),
    ...(isAdmin ? [{ href: '/admin', label: 'Admin', icon: Settings }] : []),
  ];

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
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="text-foreground/80 hover:text-foreground transition-colors flex items-center gap-1"
            >
              {Icon && <Icon className="w-3.5 h-3.5" />}
              {label}
            </Link>
          ))}
        </nav>

        {/* Desktop right side */}
        <div className="hidden md:flex items-center gap-2">
          {/* Wallet chip — dropdown when connected, button when not */}
          {isConnected ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted hover:bg-muted/70 rounded-lg text-xs transition-colors cursor-pointer">
                  <Wallet className="w-3 h-3 text-primary" />
                  <span className="font-medium">{shortAddr(account!)}</span>
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
          ) : null}

          {/* Auth section */}
          {authLoading ? null : user ? (
            <>
              {user && (
                <Button size="sm" asChild>
                  <Link href="/create-campaign">Start Campaign</Link>
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <User className="w-3.5 h-3.5" />
                    {displayName}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="gap-2">
                      <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
                    </Link>
                  </DropdownMenuItem>
                  {!isVerifier && !isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link href="/register/organization" className="gap-2">
                        <Building2 className="w-3.5 h-3.5" /> Register Organization
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {!isConnected && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={connectWallet}
                        disabled={walletLoading}
                        className="gap-2"
                      >
                        <Wallet className="w-3.5 h-3.5" />
                        {walletLoading ? 'Connecting…' : 'Connect Wallet'}
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="gap-2 text-destructive focus:text-destructive">
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login" className="gap-1.5">
                  <LogIn className="w-3.5 h-3.5" /> Sign In
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/signup">Sign Up</Link>
              </Button>
            </div>
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
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
              >
                {label}
              </Link>
            ))}

            <div className="pt-2 border-t border-border space-y-2">
              {isConnected ? (
                <div className="px-3 py-2 bg-muted rounded-lg text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{shortAddr(account!)}</p>
                      <p className="text-muted-foreground">{shortBal(balance ?? '0')} ETH</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { copyAddress(); }} className="flex-1 text-center py-1 rounded bg-background hover:bg-muted border border-border text-xs">Copy</button>
                    <button onClick={() => { switchAccount(); }} className="flex-1 text-center py-1 rounded bg-background hover:bg-muted border border-border text-xs">Switch</button>
                    <button onClick={() => { disconnectWallet(); setMobileOpen(false); }} className="flex-1 text-center py-1 rounded bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs">Disconnect</button>
                  </div>
                  {user && dbUser?.wallet_address !== account && (
                    <button onClick={() => { handleSaveWallet(); }} className="w-full text-center py-1 rounded bg-primary/10 hover:bg-primary/20 text-primary text-xs">
                      Save to profile
                    </button>
                  )}
                </div>
              ) : null}

              {user ? (
                <>
                  <Button className="w-full" size="sm" asChild>
                    <Link href="/create-campaign" onClick={() => setMobileOpen(false)}>
                      Start Campaign
                    </Link>
                  </Button>
                  {!isConnected && (
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      size="sm"
                      onClick={() => { connectWallet(); setMobileOpen(false); }}
                      disabled={walletLoading}
                    >
                      <Wallet className="w-4 h-4" />
                      {walletLoading ? 'Connecting…' : 'Connect Wallet'}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="w-full gap-2 text-destructive hover:text-destructive"
                    size="sm"
                    onClick={handleSignOut}
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </Button>
                </>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" size="sm" asChild>
                    <Link href="/login" onClick={() => setMobileOpen(false)}>Sign In</Link>
                  </Button>
                  <Button className="flex-1" size="sm" asChild>
                    <Link href="/signup" onClick={() => setMobileOpen(false)}>Sign Up</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

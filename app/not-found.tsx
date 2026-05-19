import Link from 'next/link';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { Shield } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center px-4">
          <Shield className="w-16 h-16 text-muted-foreground mx-auto mb-6 opacity-40" />
          <h1 className="text-6xl font-bold text-muted-foreground mb-2">404</h1>
          <h2 className="text-2xl font-semibold mb-3">Page Not Found</h2>
          <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
            The page you're looking for doesn't exist. It may have been removed or the URL is incorrect.
          </p>
          <div className="flex gap-3 justify-center">
            <Button asChild>
              <Link href="/">Go Home</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/campaigns">Browse Campaigns</Link>
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

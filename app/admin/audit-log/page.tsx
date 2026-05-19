'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/lib/auth-context';
import { Loader, AlertCircle, Shield, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import type { DbAdminAction } from '@/lib/types';

const ACTION_LABELS: Record<string, string> = {
  approve_campaign:   'Campaign Approved',
  reject_campaign:    'Campaign Rejected',
  approve_withdrawal: 'Withdrawal Approved',
  reject_withdrawal:  'Withdrawal Rejected',
  cancel_campaign:    'Campaign Cancelled',
};

function ActionIcon({ type }: { type: string }) {
  if (type.startsWith('approve')) return <CheckCircle className="w-4 h-4 text-success" />;
  if (type.startsWith('reject'))  return <XCircle    className="w-4 h-4 text-destructive" />;
  return <Shield className="w-4 h-4 text-muted-foreground" />;
}

export default function AuditLogPage() {
  const { isAdmin } = useAuth();
  const [actions, setActions] = useState<DbAdminAction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/admin/audit-log')
      .then((r) => r.ok ? r.json() : [])
      .then(setActions)
      .catch(() => setActions([]))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
            <p className="font-medium">Admin access required</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="bg-gradient-to-b from-muted/50 to-background py-10">
          <div className="container mx-auto px-4 flex items-center gap-4">
            <Link href="/admin" className="text-muted-foreground hover:text-foreground text-sm">
              ← Admin
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Audit Log</h1>
              <p className="text-muted-foreground">All admin actions — immutable record</p>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <Alert className="mb-6">
            <Shield className="w-4 h-4" />
            <AlertDescription className="text-sm">
              On-chain actions (approve/reject withdrawal) are permanently recorded on Sepolia.
              Campaign review actions are stored in the database.
            </AlertDescription>
          </Alert>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : actions.length === 0 ? (
            <p className="text-center text-muted-foreground py-20">No admin actions recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {actions.map((a) => (
                <Card key={a.id}>
                  <CardContent className="py-4 flex items-start gap-4">
                    <div className="mt-0.5">
                      <ActionIcon type={a.action_type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-medium text-sm">
                          {ACTION_LABELS[a.action_type] ?? a.action_type}
                        </span>
                        <Badge variant="outline" className="text-xs capitalize">
                          {a.target_type.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        Target: {a.target_id}
                      </p>
                      {a.reason && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Reason: {a.reason}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs text-muted-foreground">
                          {new Date(a.created_at).toLocaleString()}
                        </span>
                        {a.tx_hash && (
                          <a
                            href={`https://sepolia.etherscan.io/tx/${a.tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" /> On-chain
                          </a>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

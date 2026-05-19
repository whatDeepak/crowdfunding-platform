import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { updateOrganizationStatus, supabase } from '@/lib/supabase';
import type { OrgStatus } from '@/lib/types';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Admin-only
    const supabaseServer = await createSupabaseServerClient();
    const { data: { user } } = await supabaseServer.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: dbUser } = await supabase
      .from('users')
      .select('user_type')
      .eq('auth_id', user.id)
      .single();

    if (dbUser?.user_type !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { action, tier, admin_notes } = await request.json() as {
      action: 'approve' | 'reject' | 'request_more_info' | 'suspend' | 'revoke';
      tier?: number;
      admin_notes?: string;
    };

    const statusMap: Record<string, OrgStatus> = {
      approve:           'active',
      reject:            'rejected',
      request_more_info: 'more_info_needed',
      suspend:           'suspended',
      revoke:            'rejected',
    };

    const newStatus = statusMap[action];
    if (!newStatus) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const extra: Record<string, unknown> = {};
    if (admin_notes) extra.admin_notes = admin_notes;
    if (newStatus === 'active') {
      extra.approved_at = new Date().toISOString();
      extra.approved_by = user.email ?? user.id;
      if (tier === 1 || tier === 2) extra.tier = tier;
    }

    await updateOrganizationStatus(id, newStatus, extra as any);

    const { data: org } = await supabase
      .from('organizations')
      .select('user_id')
      .eq('id', id)
      .single();

    if (newStatus === 'active' && org?.user_id) {
      // Promote user to verifier role
      await supabase
        .from('users')
        .update({ user_type: 'verifier', updated_at: new Date().toISOString() })
        .eq('auth_id', org.user_id);
    }

    if ((newStatus === 'suspended' || newStatus === 'rejected') && org) {
      // Flag all this org's endorsements as under review
      await supabase
        .from('verifier_endorsements')
        .update({
          is_revoked:     true,
          revoked_by:     user.email ?? user.id,
          revoked_at:     new Date().toISOString(),
          revoked_reason: admin_notes ?? `Organization ${newStatus} by admin`,
        })
        .eq('organization_id', id)
        .eq('is_revoked', false);

      // Revert user back to donor type if suspended/revoked
      if (org.user_id) {
        await supabase
          .from('users')
          .update({ user_type: 'donor', updated_at: new Date().toISOString() })
          .eq('auth_id', org.user_id);
      }
    }

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error) {
    console.error('PATCH /api/admin/organizations/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 });
  }
}

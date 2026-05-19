import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabase } from '@/lib/supabase';

/** PATCH — admin revokes a specific endorsement */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    const { reason } = await request.json() as { reason?: string };

    const { error } = await supabase
      .from('verifier_endorsements')
      .update({
        is_revoked:     true,
        revoked_by:     user.email ?? user.id,
        revoked_at:     new Date().toISOString(),
        revoked_reason: reason ?? 'Revoked by admin',
      })
      .eq('id', id);

    if (error) {
      console.error('PATCH /api/admin/verifications/[id] error:', error);
      return NextResponse.json({ error: 'Failed to revoke endorsement' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/admin/verifications/[id] error:', error);
    return NextResponse.json({ error: 'Failed to revoke endorsement' }, { status: 500 });
  }
}

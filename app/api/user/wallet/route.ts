import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabase } from '@/lib/supabase';

/** PATCH — save/update the wallet address linked to the signed-in user */
export async function PATCH(request: NextRequest) {
  try {
    const supabaseServer = await createSupabaseServerClient();
    const { data: { user } } = await supabaseServer.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { wallet_address } = await request.json() as { wallet_address: string };
    if (!wallet_address || !/^0x[0-9a-fA-F]{40}$/.test(wallet_address)) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    const normalized = wallet_address.toLowerCase();

    // Check wallet not already owned by a different account
    const { data: existing } = await supabase
      .from('users')
      .select('auth_id')
      .eq('wallet_address', normalized)
      .neq('auth_id', user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'This wallet is linked to a different account' },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from('users')
      .update({ wallet_address: normalized, updated_at: new Date().toISOString() })
      .eq('auth_id', user.id);

    if (error) {
      console.error('PATCH /api/user/wallet error:', error);
      return NextResponse.json({ error: 'Failed to save wallet' }, { status: 500 });
    }

    return NextResponse.json({ success: true, wallet_address: normalized });
  } catch (error) {
    console.error('PATCH /api/user/wallet error:', error);
    return NextResponse.json({ error: 'Failed to save wallet' }, { status: 500 });
  }
}

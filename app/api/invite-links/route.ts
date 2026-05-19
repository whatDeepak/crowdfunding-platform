import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabase } from '@/lib/supabase';
import { randomBytes } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const supabaseServer = await createSupabaseServerClient();
    const { data: { user } } = await supabaseServer.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { campaign_id, category } = body;

    if (!campaign_id || !category) {
      return NextResponse.json({ error: 'campaign_id and category are required' }, { status: 400 });
    }

    // Verify the requester owns this campaign
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, creator_wallet')
      .eq('id', campaign_id)
      .single();

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const { data: dbUser } = await supabase
      .from('users')
      .select('wallet_address')
      .eq('auth_id', user.id)
      .single();

    const creatorWallet = dbUser?.wallet_address?.toLowerCase();
    if (creatorWallet && campaign.creator_wallet.toLowerCase() !== creatorWallet) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
      .from('org_invite_links')
      .insert({
        token,
        campaign_id,
        category,
        creator_wallet: creatorWallet ?? null,
        expires_at: expiresAt,
      });

    if (error) throw error;

    return NextResponse.json({ token }, { status: 201 });
  } catch (error) {
    console.error('POST /api/invite-links error:', error);
    return NextResponse.json({ error: 'Failed to create invite link' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'token is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('org_invite_links')
      .select('*, campaigns(title, category)')
      .eq('token', token)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Invite link not found or expired' }, { status: 404 });
    }

    if (new Date(data.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invite link has expired' }, { status: 410 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('GET /api/invite-links error:', error);
    return NextResponse.json({ error: 'Failed to fetch invite link' }, { status: 500 });
  }
}

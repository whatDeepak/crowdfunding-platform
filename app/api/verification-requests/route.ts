import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import {
  createVerificationRequest,
  getVerificationRequests,
  getCampaign,
  getActiveOrganizationsForCategory,
  supabase,
} from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const campaignId     = searchParams.get('campaignId') ?? undefined;
    const organizationId = searchParams.get('organizationId') ?? undefined;

    if (!campaignId && !organizationId) {
      return NextResponse.json({ error: 'campaignId or organizationId required' }, { status: 400 });
    }

    const requests = await getVerificationRequests({ campaignId, organizationId });
    return NextResponse.json(requests);
  } catch (error) {
    console.error('GET /api/verification-requests error:', error);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseServer = await createSupabaseServerClient();
    const { data: { user } } = await supabaseServer.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { campaignId, organizationId, creatorNote } = await request.json() as {
      campaignId:     string;
      organizationId: string;
      creatorNote?:   string;
    };

    if (!campaignId || !organizationId) {
      return NextResponse.json({ error: 'campaignId and organizationId required' }, { status: 400 });
    }

    const campaign = await getCampaign(campaignId);
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Validate that the requesting user owns the campaign
    const { data: dbUser } = await supabase
      .from('users')
      .select('wallet_address')
      .eq('auth_id', user.id)
      .single();

    if (
      dbUser?.wallet_address &&
      dbUser.wallet_address.toLowerCase() !== campaign.creator_wallet.toLowerCase()
    ) {
      return NextResponse.json({ error: 'Not campaign creator' }, { status: 403 });
    }

    // Max 3 active requests per campaign
    const existing = await getVerificationRequests({ campaignId, organizationId });
    const activeForOrg = existing.filter((r) => r.status === 'pending');
    if (activeForOrg.length > 0) {
      return NextResponse.json(
        { error: 'A pending request to this organization already exists' },
        { status: 409 }
      );
    }

    const allActive = await getVerificationRequests({ campaignId });
    const activePending = allActive.filter((r) => r.status === 'pending').length;
    if (activePending >= 3) {
      return NextResponse.json(
        { error: 'Maximum of 3 active verification requests per campaign' },
        { status: 400 }
      );
    }

    const req = await createVerificationRequest({
      campaign_id:     campaignId,
      organization_id: organizationId,
      creator_note:    creatorNote?.trim() || undefined,
    });

    if (!req) {
      return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
    }

    return NextResponse.json(req, { status: 201 });
  } catch (error) {
    console.error('POST /api/verification-requests error:', error);
    return NextResponse.json({ error: 'Failed to create verification request' }, { status: 500 });
  }
}

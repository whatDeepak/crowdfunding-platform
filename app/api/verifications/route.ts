import { NextRequest, NextResponse } from 'next/server';
import {
  createEndorsement,
  getEndorsements,
  getVerificationQueue,
  updateCampaignStatus,
  getUser,
} from '@/lib/supabase';
import type { CampaignCategory } from '@/lib/types';

/** GET — fetch endorsements for a campaign, or the verification queue for a verifier */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const campaignId = searchParams.get('campaignId');
    const queue      = searchParams.get('queue') === 'true';
    const category   = searchParams.get('category') as CampaignCategory | null;

    if (queue) {
      const campaigns = await getVerificationQueue(category ?? undefined);
      return NextResponse.json(campaigns);
    }

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId required' }, { status: 400 });
    }

    const endorsements = await getEndorsements(campaignId);
    return NextResponse.json(endorsements);
  } catch (error) {
    console.error('GET /api/verifications error:', error);
    return NextResponse.json({ error: 'Failed to fetch verifications' }, { status: 500 });
  }
}

/** POST — trusted verifier endorses a campaign */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { campaignId, verifierWallet, corroboratingDocIpfs, endorsementNote } = body;

    if (!campaignId || !verifierWallet) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify the caller is a registered verifier
    const user = await getUser(verifierWallet);
    if (!user || user.user_type !== 'verifier') {
      return NextResponse.json({ error: 'Not a registered verifier' }, { status: 403 });
    }

    const endorsement = await createEndorsement({
      campaign_id:             campaignId,
      verifier_wallet:         verifierWallet,
      verifier_org_name:       user.verifier_org_name ?? verifierWallet,
      corroborating_doc_ipfs:  corroboratingDocIpfs,
      endorsement_note:        endorsementNote,
    });

    if (!endorsement) {
      return NextResponse.json({ error: 'Failed to create endorsement' }, { status: 500 });
    }

    // Check if we now have enough endorsements to go live
    const allEndorsements = await getEndorsements(campaignId);
    if (allEndorsements.length >= 1) {
      // 1 endorsement = sufficient for pending_verification campaigns
      await updateCampaignStatus(campaignId, 'active', { platform_approved: true });
    }

    return NextResponse.json(endorsement, { status: 201 });
  } catch (error) {
    console.error('POST /api/verifications error:', error);
    return NextResponse.json({ error: 'Failed to create endorsement' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import {
  createEndorsement,
  getEndorsements,
  getVerificationQueue,
  updateCampaignStatus,
  getOrganizationByUserId,
  getCampaign,
  supabase,
} from '@/lib/supabase';
import type { CampaignCategory } from '@/lib/types';

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

export async function POST(request: NextRequest) {
  try {
    // Auth: require a signed-in user with an active organization
    const supabaseServer = await createSupabaseServerClient();
    const { data: { user } } = await supabaseServer.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = await getOrganizationByUserId(user.id);
    if (!org || org.status !== 'active') {
      return NextResponse.json(
        { error: 'You must have an approved organization to endorse campaigns' },
        { status: 403 }
      );
    }

    const {
      campaignId,
      corroboratingDocIpfs,
      endorsementNote,
      verifierWallet,
    } = await request.json() as {
      campaignId:            string;
      corroboratingDocIpfs?: string;
      endorsementNote?:      string;
      verifierWallet?:       string;
    };

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId required' }, { status: 400 });
    }
    if (!corroboratingDocIpfs) {
      return NextResponse.json({ error: 'corroboratingDocIpfs is required' }, { status: 400 });
    }
    if (!endorsementNote?.trim() || endorsementNote.trim().split(/\s+/).length < 10) {
      return NextResponse.json(
        { error: 'Endorsement note must be at least 10 words' },
        { status: 400 }
      );
    }

    const campaign = await getCampaign(campaignId);
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Domain enforcement — org must be authorized for this campaign's category
    if (!org.domains.includes(campaign.category)) {
      return NextResponse.json(
        { error: `Your organization is not authorized to verify ${campaign.category} campaigns` },
        { status: 403 }
      );
    }

    // Anti-self-endorsement
    const wallet = verifierWallet?.toLowerCase() ?? '';
    if (wallet && wallet === campaign.creator_wallet?.toLowerCase()) {
      return NextResponse.json(
        { error: 'Campaign creator cannot endorse their own campaign' },
        { status: 400 }
      );
    }

    // Duplicate check (same org already endorsed this campaign)
    const existingEndorsements = await getEndorsements(campaignId);
    const alreadyEndorsed = existingEndorsements.some(
      (e) => (e as any).organization_id === org.id
    );
    if (alreadyEndorsed) {
      return NextResponse.json(
        { error: 'Your organization has already endorsed this campaign' },
        { status: 409 }
      );
    }

    const endorsement = await createEndorsement({
      campaign_id:            campaignId,
      organization_id:        org.id,
      verifier_wallet:        wallet || org.wallet_address || user.id,
      verifier_org_name:      org.org_name,
      org_tier:               org.tier,
      corroborating_doc_ipfs: corroboratingDocIpfs,
      endorsement_note:       endorsementNote.trim(),
      is_revoked:             false,
    });

    if (!endorsement) {
      return NextResponse.json({ error: 'Failed to create endorsement' }, { status: 500 });
    }

    // Increment org endorsement counter
    await supabase
      .from('organizations')
      .update({ total_endorsements: (org.total_endorsements ?? 0) + 1 })
      .eq('id', org.id);

    // Tier-based threshold check
    const allEndorsements = await getEndorsements(campaignId);
    const tier1Count = allEndorsements.filter((e) => (e as any).org_tier === 1).length;
    const tier2Count = allEndorsements.filter((e) => (e as any).org_tier === 2).length;

    // New endorsement's tier counts even if org_tier isn't stored yet on old rows
    const effectiveTier1 = tier1Count + (org.tier === 1 ? 1 : 0);
    const effectiveTier2 = tier2Count + (org.tier === 2 ? 1 : 0);

    const shouldActivate = effectiveTier1 >= 1 || effectiveTier2 >= 2;
    if (shouldActivate && campaign.status === 'pending_verification') {
      await updateCampaignStatus(campaignId, 'active', { platform_approved: true });

      // Update org's campaigns_gone_live counter
      await supabase
        .from('organizations')
        .update({ campaigns_gone_live: (org.campaigns_gone_live ?? 0) + 1 })
        .eq('id', org.id);
    }

    return NextResponse.json({
      endorsement,
      campaign_activated: shouldActivate,
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/verifications error:', error);
    return NextResponse.json({ error: 'Failed to create endorsement' }, { status: 500 });
  }
}

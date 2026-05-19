import { NextRequest, NextResponse } from 'next/server';
import { getActiveCampaigns, searchCampaigns, createCampaign, getCreatorCampaigns } from '@/lib/supabase';
import type { DbCampaign, CampaignCategory } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const limit    = parseInt(searchParams.get('limit')    || '20');
    const offset   = parseInt(searchParams.get('offset')   || '0');
    const query    = searchParams.get('q')                  || '';
    const category = searchParams.get('category') as CampaignCategory | null;
    const creator  = searchParams.get('creator');

    let campaigns;
    if (creator) {
      campaigns = await getCreatorCampaigns(creator);
    } else if (query) {
      campaigns = await searchCampaigns(query, limit);
    } else {
      campaigns = await getActiveCampaigns(limit, offset, category ?? undefined);
    }

    return NextResponse.json(campaigns);
  } catch (error) {
    console.error('GET /api/campaigns error:', error);
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Partial<DbCampaign>;

    const required = ['creator_wallet', 'title', 'description', 'category', 'target_amount_eth'];
    for (const field of required) {
      if (!body[field as keyof DbCampaign]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    const campaign = await createCampaign({
      creator_wallet:     body.creator_wallet!,
      title:              body.title!,
      description:        body.description!,
      category:           body.category!,
      image_url:          body.image_url,
      target_amount_eth:  body.target_amount_eth!,
      current_amount_eth: 0,
      status:             'pending_ai',
      deadline:           body.deadline,
      ipfs_metadata_hash: body.ipfs_metadata_hash,
      platform_approved:  false,
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
    }

    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    console.error('POST /api/campaigns error:', error);
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
  }
}

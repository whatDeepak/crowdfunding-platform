import { NextRequest, NextResponse } from 'next/server';
import {
  getCampaign,
  getMilestones,
  getEndorsements,
  getDonations,
  updateCampaignContractId,
} from '@/lib/supabase';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [campaign, milestones, endorsements, donations] = await Promise.all([
      getCampaign(id),
      getMilestones(id),
      getEndorsements(id),
      getDonations(id),
    ]);

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    return NextResponse.json({ campaign, milestones, endorsements, donations });
  } catch (error) {
    console.error('GET /api/campaigns/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch campaign' }, { status: 500 });
  }
}

/** PATCH — set contract_id after on-chain campaign creation */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { contractId } = await request.json();

    if (contractId === undefined || contractId === null) {
      return NextResponse.json({ error: 'contractId required' }, { status: 400 });
    }

    await updateCampaignContractId(id, contractId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/campaigns/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
  }
}

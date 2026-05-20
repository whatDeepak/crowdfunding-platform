import { NextRequest, NextResponse } from 'next/server';
import {
  getCampaign,
  getMilestones,
  getEndorsements,
  getDonations,
  updateCampaignContractId,
  deleteCampaign,
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

const DELETABLE_STATUSES = ['pending_ai', 'pending_verification', 'pending_review', 'needs_more_proof', 'rejected'];

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const campaign = await getCampaign(id);
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }
    if (campaign.contract_id != null) {
      return NextResponse.json({ error: 'Cannot delete a campaign that is published on-chain' }, { status: 409 });
    }
    if (!DELETABLE_STATUSES.includes(campaign.status)) {
      return NextResponse.json({ error: 'Campaign cannot be deleted in its current status' }, { status: 409 });
    }

    const donations = await getDonations(id);
    if (donations.some((d) => d.status === 'confirmed')) {
      return NextResponse.json({ error: 'Cannot delete a campaign with confirmed donations' }, { status: 409 });
    }

    await deleteCampaign(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('DELETE /api/campaigns/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 });
  }
}

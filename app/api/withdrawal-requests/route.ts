import { NextRequest, NextResponse } from 'next/server';
import {
  createWithdrawalRequest,
  getWithdrawalRequests,
  getAllPendingWithdrawals,
  getMilestones,
  updateCampaignStatus,
} from '@/lib/supabase';
import type { DbWithdrawalRequest } from '@/lib/types';

/** GET — list withdrawal requests for a campaign (or all pending for admin) */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const campaignId = searchParams.get('campaignId');
    const allPending = searchParams.get('pending') === 'true';

    if (allPending) {
      const requests = await getAllPendingWithdrawals();
      return NextResponse.json(requests);
    }

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId required' }, { status: 400 });
    }

    const requests = await getWithdrawalRequests(campaignId);
    return NextResponse.json(requests);
  } catch (error) {
    console.error('GET /api/withdrawal-requests error:', error);
    return NextResponse.json({ error: 'Failed to fetch withdrawal requests' }, { status: 500 });
  }
}

/** POST — creator submits a new withdrawal request */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Partial<DbWithdrawalRequest>;

    const required = ['campaign_id', 'requested_amount_eth', 'proof_ipfs_hash'];
    for (const field of required) {
      if (!body[field as keyof DbWithdrawalRequest]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    // Update milestone status if milestone_id provided
    if (body.milestone_id) {
      // Milestone status update will be handled when admin approves
    }

    const withdrawalRequest = await createWithdrawalRequest({
      campaign_id:          body.campaign_id!,
      milestone_id:         body.milestone_id,
      contract_request_id:  body.contract_request_id,
      requested_amount_eth: body.requested_amount_eth!,
      proof_ipfs_hash:      body.proof_ipfs_hash!,
      proof_description:    body.proof_description,
      status:               'pending',
    });

    if (!withdrawalRequest) {
      return NextResponse.json({ error: 'Failed to create withdrawal request' }, { status: 500 });
    }

    return NextResponse.json(withdrawalRequest, { status: 201 });
  } catch (error) {
    console.error('POST /api/withdrawal-requests error:', error);
    return NextResponse.json({ error: 'Failed to create withdrawal request' }, { status: 500 });
  }
}

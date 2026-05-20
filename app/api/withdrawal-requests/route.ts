import { NextRequest, NextResponse } from 'next/server';
import {
  createWithdrawalRequest,
  getWithdrawalRequests,
  getAllPendingWithdrawals,
  getMilestones,
  getCampaign,
  updateMilestoneStatus,
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

    // Fetch campaign for contract and balance checks
    const campaign = await getCampaign(body.campaign_id!);
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }
    if (campaign.contract_id == null) {
      return NextResponse.json({ error: 'Campaign is not published on-chain yet' }, { status: 409 });
    }

    const existing = await getWithdrawalRequests(body.campaign_id!);

    // Milestone-specific validation
    if (body.milestone_id) {
      const milestones = await getMilestones(body.campaign_id!);
      const milestone  = milestones.find((m) => m.id === body.milestone_id);

      if (!milestone) {
        return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
      }
      if (milestone.status !== 'pending') {
        return NextResponse.json(
          { error: 'This milestone already has an active or completed withdrawal' },
          { status: 409 }
        );
      }

      // All milestones with lower sequence_order must be released
      const blockers = milestones.filter(
        (m) => m.sequence_order < milestone.sequence_order && m.status !== 'released'
      );
      if (blockers.length > 0) {
        return NextResponse.json(
          { error: 'Previous milestones must be completed before requesting this one' },
          { status: 409 }
        );
      }

      // No pending or approved withdrawal already exists for this milestone
      const duplicate = existing.find(
        (w) => w.milestone_id === body.milestone_id &&
               (w.status === 'pending' || w.status === 'approved')
      );
      if (duplicate) {
        return NextResponse.json(
          { error: 'A withdrawal request already exists for this milestone' },
          { status: 409 }
        );
      }
    }

    // Available balance check
    const totalWithdrawn = existing
      .filter((w) => w.status === 'approved')
      .reduce((s, w) => s + Number(w.requested_amount_eth), 0);
    const availableBalance = (campaign.current_amount_eth ?? 0) - totalWithdrawn;
    if (Number(body.requested_amount_eth) > availableBalance + 0.000001) {
      return NextResponse.json(
        { error: `Requested amount exceeds available balance (${availableBalance.toFixed(4)} ETH)` },
        { status: 409 }
      );
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

    // Lock the milestone
    if (body.milestone_id) {
      await updateMilestoneStatus(body.milestone_id, 'withdrawal_requested');
    }

    return NextResponse.json(withdrawalRequest, { status: 201 });
  } catch (error) {
    console.error('POST /api/withdrawal-requests error:', error);
    return NextResponse.json({ error: 'Failed to create withdrawal request' }, { status: 500 });
  }
}

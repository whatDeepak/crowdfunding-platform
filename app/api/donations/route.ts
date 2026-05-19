import { NextRequest, NextResponse } from 'next/server';
import { recordDonation, getDonations, getDonorHistory, updateDonationStatus } from '@/lib/supabase';
import type { DbDonation } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const campaignId   = searchParams.get('campaignId');
    const donorWallet  = searchParams.get('donor');

    if (donorWallet) {
      const history = await getDonorHistory(donorWallet);
      return NextResponse.json(history);
    }

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId or donor required' }, { status: 400 });
    }

    const donations = await getDonations(campaignId);
    return NextResponse.json(donations);
  } catch (error) {
    console.error('GET /api/donations error:', error);
    return NextResponse.json({ error: 'Failed to fetch donations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Omit<DbDonation, 'id' | 'created_at'>;

    if (!body.campaign_id || !body.donor_wallet || !body.amount_eth || !body.transaction_hash) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const donation = await recordDonation(body);

    if (!donation) {
      return NextResponse.json({ error: 'Failed to record donation' }, { status: 500 });
    }

    return NextResponse.json(donation, { status: 201 });
  } catch (error) {
    console.error('POST /api/donations error:', error);
    return NextResponse.json({ error: 'Failed to record donation' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { txHash, status, blockNumber } = await request.json();

    if (!txHash || !status) {
      return NextResponse.json({ error: 'txHash and status required' }, { status: 400 });
    }

    await updateDonationStatus(txHash, status, blockNumber);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/donations error:', error);
    return NextResponse.json({ error: 'Failed to update donation' }, { status: 500 });
  }
}

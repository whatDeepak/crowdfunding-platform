import { NextRequest, NextResponse } from 'next/server';
import { updateCampaignStatus, logAdminAction } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { campaignId, adminWallet, txHash } = await request.json();

    if (!campaignId || !adminWallet) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const configuredAdmin = process.env.NEXT_PUBLIC_ADMIN_WALLET?.toLowerCase();
    if (!configuredAdmin || adminWallet.toLowerCase() !== configuredAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await updateCampaignStatus(campaignId, 'cancelled');

    await logAdminAction({
      admin_wallet: adminWallet,
      action_type:  'cancel_campaign',
      target_id:    campaignId,
      target_type:  'campaign',
      tx_hash:      txHash ?? undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/admin/cancel-campaign error:', error);
    return NextResponse.json({ error: 'Failed to cancel campaign' }, { status: 500 });
  }
}

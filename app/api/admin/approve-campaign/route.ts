import { NextRequest, NextResponse } from 'next/server';
import { updateCampaignStatus, logAdminAction } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { campaignId, adminWallet, action, reason } = await request.json();

    if (!campaignId || !adminWallet || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });
    }

    const configuredAdmin = process.env.NEXT_PUBLIC_ADMIN_WALLET?.toLowerCase();
    if (!configuredAdmin || adminWallet.toLowerCase() !== configuredAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const newStatus = action === 'approve' ? 'active' : 'rejected';
    await updateCampaignStatus(campaignId, newStatus as 'active' | 'rejected', {
      platform_approved: action === 'approve',
    });

    await logAdminAction({
      admin_wallet: adminWallet,
      action_type:  action === 'approve' ? 'approve_campaign' : 'reject_campaign',
      target_id:    campaignId,
      target_type:  'campaign',
      reason:       reason ?? undefined,
    });

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error) {
    console.error('POST /api/admin/approve-campaign error:', error);
    return NextResponse.json({ error: 'Failed to update campaign status' }, { status: 500 });
  }
}

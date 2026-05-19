import { NextRequest, NextResponse } from 'next/server';
import { updateWithdrawalStatus, logAdminAction } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { withdrawalId, campaignId, reason, adminWallet } = await request.json();

    if (!withdrawalId || !reason || !adminWallet) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const configuredAdmin = process.env.NEXT_PUBLIC_ADMIN_WALLET?.toLowerCase();
    if (!configuredAdmin || adminWallet.toLowerCase() !== configuredAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await updateWithdrawalStatus(withdrawalId, 'rejected', { rejection_reason: reason });

    await logAdminAction({
      admin_wallet: adminWallet,
      action_type:  'reject_withdrawal',
      target_id:    withdrawalId,
      target_type:  'withdrawal_request',
      reason,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/admin/reject-withdrawal error:', error);
    return NextResponse.json({ error: 'Failed to record rejection' }, { status: 500 });
  }
}

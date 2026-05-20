import { NextRequest, NextResponse } from 'next/server';
import { updateWithdrawalStatus, logAdminAction, updateMilestoneStatus, supabase } from '@/lib/supabase';

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

    // Reset milestone back to pending so creator can retry
    const { data: wr } = await supabase
      .from('withdrawal_requests')
      .select('milestone_id')
      .eq('id', withdrawalId)
      .single();
    if (wr?.milestone_id) {
      await updateMilestoneStatus(wr.milestone_id, 'pending');
    }

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

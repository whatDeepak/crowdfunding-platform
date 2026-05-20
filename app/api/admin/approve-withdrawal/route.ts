import { NextRequest, NextResponse } from 'next/server';
import { updateWithdrawalStatus, logAdminAction, updateMilestoneStatus, supabase } from '@/lib/supabase';

/**
 * POST /api/admin/approve-withdrawal
 * Records the admin approval in the DB after the on-chain tx has been sent.
 * The actual ETH release happens via the smart contract (MetaMask in the admin UI).
 */
export async function POST(request: NextRequest) {
  try {
    const { withdrawalId, campaignId, txHash, adminWallet } = await request.json();

    if (!withdrawalId || !adminWallet) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify admin — compare against env var (public wallet address)
    const configuredAdmin = process.env.NEXT_PUBLIC_ADMIN_WALLET?.toLowerCase();
    if (!configuredAdmin || adminWallet.toLowerCase() !== configuredAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await updateWithdrawalStatus(withdrawalId, 'approved', {
      admin_tx_hash: txHash,
    });

    // Mark the milestone as released
    const { data: wr } = await supabase
      .from('withdrawal_requests')
      .select('milestone_id')
      .eq('id', withdrawalId)
      .single();
    if (wr?.milestone_id) {
      await updateMilestoneStatus(wr.milestone_id, 'released');
    }

    await logAdminAction({
      admin_wallet: adminWallet,
      action_type:  'approve_withdrawal',
      target_id:    withdrawalId,
      target_type:  'withdrawal_request',
      tx_hash:      txHash,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/admin/approve-withdrawal error:', error);
    return NextResponse.json({ error: 'Failed to record approval' }, { status: 500 });
  }
}

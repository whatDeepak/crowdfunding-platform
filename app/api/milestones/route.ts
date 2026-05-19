import { NextRequest, NextResponse } from 'next/server';
import { createMilestone } from '@/lib/supabase';
import type { DbMilestone } from '@/lib/types';

/** POST — create multiple milestones for a campaign */
export async function POST(request: NextRequest) {
  try {
    const { campaignId, milestones } = await request.json() as {
      campaignId: string;
      milestones: Omit<DbMilestone, 'id' | 'campaign_id' | 'status'>[];
    };

    if (!campaignId || !Array.isArray(milestones) || milestones.length === 0) {
      return NextResponse.json({ error: 'campaignId and milestones array required' }, { status: 400 });
    }

    const created = await Promise.all(
      milestones.map((m, i) =>
        createMilestone({
          campaign_id:       campaignId,
          title:             m.title,
          description:       m.description,
          target_amount_eth: m.target_amount_eth,
          sequence_order:    i + 1,
          status:            'pending',
        })
      )
    );

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('POST /api/milestones error:', error);
    return NextResponse.json({ error: 'Failed to create milestones' }, { status: 500 });
  }
}

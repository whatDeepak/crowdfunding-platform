import { NextRequest, NextResponse } from 'next/server';
import { getAdminReviewQueue } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const campaigns = await getAdminReviewQueue();
    return NextResponse.json(campaigns);
  } catch (error) {
    console.error('GET /api/admin/campaigns error:', error);
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }
}

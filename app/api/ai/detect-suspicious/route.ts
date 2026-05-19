// Deprecated — functionality merged into /api/ai/verify-campaign
import { NextResponse } from 'next/server';
export async function POST() {
  return NextResponse.json(
    { error: 'This endpoint is deprecated. Use /api/ai/verify-campaign instead.' },
    { status: 410 }
  );
}

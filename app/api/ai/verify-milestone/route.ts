// Deprecated — replaced by /api/ai/analyze-proof
import { NextResponse } from 'next/server';
export async function POST() {
  return NextResponse.json(
    { error: 'This endpoint is deprecated. Use /api/ai/analyze-proof instead.' },
    { status: 410 }
  );
}

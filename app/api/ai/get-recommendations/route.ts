// Deprecated — recommendations removed from MVP scope
import { NextResponse } from 'next/server';
export async function POST() {
  return NextResponse.json(
    { error: 'This endpoint is deprecated and no longer available.' },
    { status: 410 }
  );
}

import { NextRequest, NextResponse } from 'next/server';
import { getUser, upsertUser } from '@/lib/supabase';

export async function GET(
  _request: NextRequest,
  { params }: { params: { wallet: string } }
) {
  try {
    const user = await getUser(params.wallet);
    if (!user) return NextResponse.json(null, { status: 404 });
    return NextResponse.json(user);
  } catch (error) {
    console.error('GET /api/users/[wallet] error:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

/** POST — upsert user on wallet connect */
export async function POST(
  _request: NextRequest,
  { params }: { params: { wallet: string } }
) {
  try {
    const user = await upsertUser(params.wallet);
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error('POST /api/users/[wallet] error:', error);
    return NextResponse.json({ error: 'Failed to upsert user' }, { status: 500 });
  }
}

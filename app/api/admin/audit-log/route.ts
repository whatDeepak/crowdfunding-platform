import { NextResponse } from 'next/server';
import { getAdminActions } from '@/lib/supabase';

export async function GET() {
  try {
    const actions = await getAdminActions();
    return NextResponse.json(actions);
  } catch (error) {
    console.error('GET /api/admin/audit-log error:', error);
    return NextResponse.json({ error: 'Failed to fetch audit log' }, { status: 500 });
  }
}

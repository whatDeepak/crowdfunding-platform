import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { contract_request_id } = body;
    if (contract_request_id == null) {
      return NextResponse.json({ error: 'contract_request_id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('withdrawal_requests')
      .update({ contract_request_id })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error('PATCH /api/withdrawal-requests/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update withdrawal request' }, { status: 500 });
  }
}

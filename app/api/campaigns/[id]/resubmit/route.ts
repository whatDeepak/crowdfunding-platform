import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getCampaign, supabase } from '@/lib/supabase';
import { uploadFileToPinata } from '@/lib/pinata';

const RESUBMITTABLE_STATUSES = ['needs_more_proof', 'pending_verification', 'rejected'];
const MAX_RESUBMISSIONS = 3;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supabaseServer = await createSupabaseServerClient();
    const { data: { user } } = await supabaseServer.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const campaign = await getCampaign(id);
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    if (!RESUBMITTABLE_STATUSES.includes(campaign.status)) {
      return NextResponse.json(
        { error: 'Campaign cannot be resubmitted in its current status' },
        { status: 409 }
      );
    }

    // Verify ownership
    const { data: dbUser } = await supabase
      .from('users')
      .select('wallet_address')
      .eq('auth_id', user.id)
      .single();

    if (
      !dbUser?.wallet_address ||
      dbUser.wallet_address.toLowerCase() !== campaign.creator_wallet.toLowerCase()
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const analysisVersion = (campaign as any).analysis_version ?? 1;
    if (analysisVersion >= MAX_RESUBMISSIONS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_RESUBMISSIONS} re-analyses reached. Contact admin for manual review.` },
        { status: 429 }
      );
    }

    // Accept files via FormData
    const form = await request.formData();
    const files = form.getAll('documents').filter((f): f is File => f instanceof File);

    if (files.length === 0) {
      return NextResponse.json({ error: 'At least one document is required' }, { status: 400 });
    }

    // Upload each file to Pinata (graceful: skip failures)
    const docCids: string[] = [];
    for (const file of files) {
      try {
        const cid = await uploadFileToPinata(file);
        docCids.push(cid);
      } catch (err) {
        console.warn(`Pinata upload failed for ${file.name}:`, err);
      }
    }

    // Increment version
    await supabase
      .from('campaigns')
      .update({ analysis_version: analysisVersion + 1, last_analysis_at: new Date().toISOString() })
      .eq('id', id);

    // Delegate to the AI verify-campaign endpoint
    const origin = new URL(request.url).origin;
    const aiRes = await fetch(`${origin}/api/ai/verify-campaign`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignId:       id,
        imageUrl:         campaign.image_url,
        documentIpfsCids: docCids,
      }),
    });

    if (!aiRes.ok) {
      // Roll back version on failure
      await supabase
        .from('campaigns')
        .update({ analysis_version: analysisVersion })
        .eq('id', id);
      const errText = await aiRes.text();
      return NextResponse.json({ error: `AI analysis failed: ${errText}` }, { status: 500 });
    }

    const result = await aiRes.json();
    return NextResponse.json({ ...result, analysis_version: analysisVersion + 1 });
  } catch (error) {
    console.error('POST /api/campaigns/[id]/resubmit error:', error);
    return NextResponse.json({ error: 'Resubmission failed' }, { status: 500 });
  }
}

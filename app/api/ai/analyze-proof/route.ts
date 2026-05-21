import { NextRequest, NextResponse } from 'next/server';
import {
  getWithdrawalRequests,
  getWithdrawalRequestById,
  saveWithdrawalAiResult,
  logAiVerification,
} from '@/lib/supabase';
import type { ProofAnalysisRequest, ProofAnalysisResult } from '@/lib/types';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ProofAnalysisRequest & { withdrawalRequestId: string };
    const { withdrawalRequestId, ...analysisInput } = body;

    if (!withdrawalRequestId || !analysisInput.milestoneTitle || !analysisInput.proofDescription) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!AI_SERVICE_URL) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
    }

    // Fetch the withdrawal request to get the proof IPFS CID
    const withdrawal = await getWithdrawalRequestById(withdrawalRequestId);

    const aiResponse = await fetch(`${AI_SERVICE_URL}/analyze-proof`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        milestone_title:      analysisInput.milestoneTitle,
        milestone_amount_eth: analysisInput.milestoneAmount,
        proof_description:    analysisInput.proofDescription,
        proof_ipfs_cid:       withdrawal?.proof_ipfs_hash ?? null,
        document_names:       analysisInput.documentNames ?? [],
        campaign_title:       analysisInput.campaignTitle,
        campaign_category:    analysisInput.campaignCategory,
        previous_milestones:  analysisInput.previousMilestones ?? [],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('AI service error:', errText);
      return NextResponse.json({ error: 'AI service failed' }, { status: 502 });
    }

    const raw = await aiResponse.json();

    const result: ProofAnalysisResult = {
      consistencyScore: raw.consistency_score,
      aiRecommendation: raw.ai_recommendation,
      flags:            raw.flags,
      adminNote:        raw.admin_note,
    };

    // Persist to withdrawal request row
    await saveWithdrawalAiResult(withdrawalRequestId, result);

    // Audit log
    await logAiVerification({
      campaign_id:       undefined,
      withdrawal_id:     withdrawalRequestId,
      verification_type: 'proof_analysis',
      text_score:        undefined,
      semantic_score:    undefined,
      amount_score:      undefined,
      image_reuse_flag:  false,
      final_score:       result.consistencyScore,
      risk_level:        result.consistencyScore >= 75 ? 'low' : result.consistencyScore >= 50 ? 'medium' : 'high',
      flags:             result.flags,
      explanation:       result.adminNote,
      raw_response:      raw,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('POST /api/ai/analyze-proof error:', error);
    return NextResponse.json({ error: 'Proof analysis failed' }, { status: 500 });
  }
}

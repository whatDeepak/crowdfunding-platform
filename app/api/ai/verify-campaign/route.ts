import { NextRequest, NextResponse } from 'next/server';
import {
  getAllCampaignEmbeddings,
  getAllImageHashes,
  saveCampaignAiResult,
  updateCampaignStatus,
  logAiVerification,
} from '@/lib/supabase';
import type { CampaignAnalysisRequest, CampaignAnalysisResult } from '@/lib/types';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as CampaignAnalysisRequest & { campaignId: string };
    const { campaignId, ...analysisInput } = body;

    if (!campaignId || !analysisInput.title || !analysisInput.description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!AI_SERVICE_URL) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
    }

    // Fetch existing embeddings + image hashes for comparison
    const [embeddingRows, imageHashes] = await Promise.all([
      getAllCampaignEmbeddings(),
      getAllImageHashes(),
    ]);

    const existingEmbeddings = embeddingRows
      .filter((r) => r.id !== campaignId && Array.isArray(r.embedding))
      .map((r) => r.embedding as number[]);

    // Call the HuggingFace Spaces AI service
    const aiResponse = await fetch(`${AI_SERVICE_URL}/analyze-campaign`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title:                 analysisInput.title,
        description:           analysisInput.description,
        target_amount_eth:     analysisInput.targetAmountEth,
        category:              analysisInput.category,
        document_names:        analysisInput.documentNames ?? [],
        existing_embeddings:   existingEmbeddings,
        existing_image_hashes: imageHashes,
        image_url:             analysisInput.imageUrl,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('AI service error:', errText);
      return NextResponse.json({ error: 'AI service failed' }, { status: 502 });
    }

    const raw = await aiResponse.json();

    const result: CampaignAnalysisResult = {
      trustScore:     raw.trust_score,
      riskLevel:      raw.risk_level,
      textScore:      raw.text_score,
      semanticScore:  raw.semantic_score,
      amountScore:    raw.amount_score,
      imageReuseFlag: raw.image_reuse_flag,
      flags:          raw.flags,
      explanation:    raw.explanation,
      embedding:      raw.embedding,
    };

    // Persist scores to campaign row and update routing status
    await saveCampaignAiResult(campaignId, result);

    let newStatus: 'active' | 'pending_verification' | 'pending_review';
    if (result.trustScore >= 70)      newStatus = 'active';
    else if (result.trustScore >= 40) newStatus = 'pending_verification';
    else                              newStatus = 'pending_review';

    await updateCampaignStatus(campaignId, newStatus);

    // Audit log
    await logAiVerification({
      campaign_id:       campaignId,
      withdrawal_id:     undefined,
      verification_type: 'campaign_analysis',
      text_score:        result.textScore,
      semantic_score:    result.semanticScore,
      amount_score:      result.amountScore,
      image_reuse_flag:  result.imageReuseFlag,
      final_score:       result.trustScore,
      risk_level:        result.riskLevel,
      flags:             result.flags,
      explanation:       result.explanation,
      raw_response:      raw,
    });

    return NextResponse.json({ ...result, campaignStatus: newStatus });
  } catch (error) {
    console.error('POST /api/ai/verify-campaign error:', error);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import {
  getCampaign,
  getAllCampaignEmbeddings,
  getAllImageHashes,
  saveCampaignAiResult,
  updateCampaignStatus,
  logAiVerification,
} from '@/lib/supabase';
import type { CampaignAnalysisResult } from '@/lib/types';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL;

// ── Local dev mock — used when AI_SERVICE_URL is not set ──────────────────────
function mockAnalysis(
  targetEth: number,
  description: string,
  numDocs: number
): CampaignAnalysisResult {
  const wordCount = description.trim().split(/\s+/).length;

  // Raw signal scores (0-25 each) — then scaled in combiner
  const textScore     = wordCount < 30 ? 5 : wordCount < 60 ? 12 : wordCount < 150 ? 18 : 22;
  const semanticScore = 18;
  const amountScore   = targetEth <= 2 ? 25 : targetEth <= 10 ? 20 : targetEth <= 50 ? 10 : 3;
  const imageScore    = 12;

  // Document alignment: mock gives partial credit for uploads (can't actually OCR in mock)
  const documentAlignmentScore = Math.min(40, numDocs * 8);

  // Apply same scaling as score_combiner (20+15+15+10+40)
  const adjText     = Math.round(textScore     * 20 / 25);
  const adjSemantic = Math.round(semanticScore * 15 / 25);
  const adjAmount   = Math.round(amountScore   * 15 / 25);
  const adjImage    = Math.round(imageScore    * 10 / 25);
  const trustScore  = Math.min(100, adjText + adjSemantic + adjAmount + adjImage + documentAlignmentScore);

  const flags = [
    ...(wordCount < 30 ? ['description_too_short'] : []),
    ...(numDocs === 0 ? ['no_documents_uploaded'] : []),
  ];

  return {
    trustScore,
    riskLevel:              trustScore >= 70 ? 'low' : trustScore >= 40 ? 'medium' : 'high',
    textScore,
    semanticScore,
    amountScore,
    imageScore,
    documentAlignmentScore,
    imageReuseFlag:         false,
    isAiGenerated:          false,
    isStockPhoto:           false,
    visionDescription:      '',
    documentFlags:          numDocs === 0 ? ['no_documents_uploaded'] : [],
    flags,
    explanation:            `[Dev mode — no AI service] Trust score: ${trustScore}/100. ` +
                            `${numDocs === 0 ? 'No documents uploaded — document alignment score is 0/40. Upload proof documents to improve your score.' : `${numDocs} document(s) uploaded (partial credit in mock mode; real analysis requires AI service).`} ` +
                            `Set AI_SERVICE_URL to enable real ML analysis.`,
    embedding:              [],
  };
}

export async function POST(request: NextRequest) {
  try {
    const { campaignId, imageUrl, documentIpfsCids } = await request.json() as {
      campaignId: string;
      imageUrl?: string;
      documentIpfsCids?: string[];
    };

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId required' }, { status: 400 });
    }

    const campaign = await getCampaign(campaignId);
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const docCids = documentIpfsCids ?? [];
    let result: CampaignAnalysisResult;

    if (!AI_SERVICE_URL) {
      result = mockAnalysis(campaign.target_amount_eth, campaign.description, docCids.length);
    } else {
      const [embeddingRows, imageHashes] = await Promise.all([
        getAllCampaignEmbeddings(),
        getAllImageHashes(),
      ]);

      const existingEmbeddings = embeddingRows
        .filter((r) => r.id !== campaignId && Array.isArray(r.embedding))
        .map((r) => r.embedding as number[]);

      const aiResponse = await fetch(`${AI_SERVICE_URL}/analyze-campaign`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:                 campaign.title,
          description:           campaign.description,
          target_amount_eth:     campaign.target_amount_eth,
          category:              campaign.category,
          document_ipfs_cids:    docCids,
          existing_embeddings:   existingEmbeddings,
          existing_image_hashes: imageHashes,
          image_url:             imageUrl ?? campaign.image_url,
          campaign_created_at:   campaign.created_at,
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error('AI service error:', errText);
        result = mockAnalysis(campaign.target_amount_eth, campaign.description, docCids.length);
      } else {
        const raw = await aiResponse.json();
        result = {
          trustScore:              raw.trust_score,
          riskLevel:               raw.risk_level,
          textScore:               raw.text_score,
          semanticScore:           raw.semantic_score,
          amountScore:             raw.amount_score,
          imageScore:              raw.image_score         ?? 12,
          documentAlignmentScore:  raw.document_alignment_score ?? 0,
          imageReuseFlag:          raw.image_reuse_flag    ?? false,
          isAiGenerated:           raw.is_ai_generated     ?? false,
          isStockPhoto:            raw.is_stock_photo      ?? false,
          visionDescription:       raw.vision_description  ?? '',
          documentFlags:           raw.document_flags      ?? [],
          flags:                   raw.flags               ?? [],
          explanation:             raw.explanation         ?? '',
          embedding:               raw.embedding           ?? [],
        };
      }
    }

    await saveCampaignAiResult(campaignId, result);

    // 4-tier status routing (new: needs_more_proof tier)
    let newStatus: 'active' | 'pending_verification' | 'needs_more_proof' | 'rejected';
    if      (result.trustScore >= 70) newStatus = 'active';
    else if (result.trustScore >= 40) newStatus = 'pending_verification';
    else if (result.trustScore >= 25) newStatus = 'needs_more_proof';
    else                              newStatus = 'rejected';

    await updateCampaignStatus(campaignId, newStatus as Parameters<typeof updateCampaignStatus>[1]);

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
      raw_response:      {
        image_score:              result.imageScore,
        document_alignment_score: result.documentAlignmentScore,
        is_ai_generated:          result.isAiGenerated,
        is_stock_photo:           result.isStockPhoto,
        vision_description:       result.visionDescription,
        document_flags:           result.documentFlags,
      },
    });

    return NextResponse.json({
      trust_score:              result.trustScore,
      risk_level:               result.riskLevel,
      document_alignment_score: result.documentAlignmentScore,
      document_flags:           result.documentFlags,
      flags:                    result.flags,
      explanation:              result.explanation,
      campaign_status:          newStatus,
    });
  } catch (error) {
    console.error('POST /api/ai/verify-campaign error:', error);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}

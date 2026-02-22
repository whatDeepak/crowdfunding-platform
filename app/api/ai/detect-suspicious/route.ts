import { NextRequest, NextResponse } from 'next/server';
import { createSuspiciousFlag } from '@/lib/supabase';

const GROQ_API_KEY = process.env.GROQ_API_KEY;

interface DetectionRequest {
  campaignId: number;
  title: string;
  description: string;
}

const FRAUD_INDICATORS = [
  'limited time offer',
  'act now',
  'urgent',
  'guarantee',
  'risk-free',
  'easy money',
  'guaranteed return',
  'won\'t last long',
  'exclusive offer',
  'secret method',
  'too good to be true',
  'bitcoin',
  'crypto',
  'forex',
  'nigerian prince',
  'wire transfer',
  'western union',
];

export async function POST(request: NextRequest) {
  try {
    if (!GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'AI verification is not configured' },
        { status: 503 }
      );
    }

    const body: DetectionRequest = await request.json();
    const { campaignId, title, description } = body;

    const fullText = `${title} ${description}`.toLowerCase();

    // First pass: Check for obvious fraud indicators
    const foundIndicators = FRAUD_INDICATORS.filter((indicator) =>
      fullText.includes(indicator)
    );

    const suspiciousElements: string[] = [];

    if (foundIndicators.length > 0) {
      suspiciousElements.push(
        ...foundIndicators.map((ind) => `Found fraud indicator: "${ind}"`)
      );
    }

    // Second pass: Use AI for semantic analysis
    const detectionPrompt = `
Analyze this crowdfunding campaign for suspicious or fraudulent elements.
Look for common scam tactics, phishing attempts, and deceptive language.

Title: ${title}
Description: ${description}

Respond ONLY with valid JSON (no markdown, no backticks):
{
  "riskLevel": "low" or "medium" or "high",
  "suspiciousPatterns": [list of strings],
  "concernFlags": [list of strings]
}
`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'mixtral-8x7b-32768',
        messages: [
          {
            role: 'user',
            content: detectionPrompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 400,
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.statusText}`);
    }

    const aiResponse = await response.json();
    const analysisText = aiResponse.choices[0].message.content;

    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse AI response');
    }

    const analysis = JSON.parse(jsonMatch[0]);

    // Store flags if suspicious
    if (analysis.riskLevel !== 'low') {
      for (const flag of [
        ...foundIndicators,
        ...(analysis.suspiciousPatterns || []),
        ...(analysis.concernFlags || []),
      ]) {
        await createSuspiciousFlag(campaignId, {
          flag_type: 'content_detection',
          description: flag,
          severity: analysis.riskLevel === 'high' ? 'high' : 'medium',
        });
      }
    }

    return NextResponse.json({
      success: true,
      campaignId,
      riskLevel: analysis.riskLevel,
      suspiciousPatterns: analysis.suspiciousPatterns || [],
      foundIndicators,
      isSuspicious: analysis.riskLevel !== 'low',
    });
  } catch (error) {
    console.error('Error detecting suspicious content:', error);
    return NextResponse.json(
      { error: 'Failed to detect suspicious content' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createAIVerification, getCampaignMetadata, createSuspiciousFlag } from '@/lib/supabase';

const GROQ_API_KEY = process.env.GROQ_API_KEY;

interface VerificationRequest {
  campaignId: number;
  title: string;
  description: string;
  targetAmount: number;
  creatorAddress: string;
}

export async function POST(request: NextRequest) {
  try {
    if (!GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'AI verification is not configured' },
        { status: 503 }
      );
    }

    const body: VerificationRequest = await request.json();
    const { campaignId, title, description, targetAmount, creatorAddress } = body;

    // Check if campaign already verified
    const existingVerification = await getCampaignMetadata(campaignId);
    if (existingVerification?.ai_verification_completed) {
      return NextResponse.json(
        { error: 'Campaign already verified' },
        { status: 400 }
      );
    }

    // Call Groq to analyze campaign (free API)
    const analysisPrompt = `
You are an expert at analyzing crowdfunding campaigns for legitimacy and potential fraud.
Analyze the following campaign and provide a legitimacy score (0-100) and identify any suspicious elements.

Campaign Title: ${title}
Description: ${description}
Target Amount: $${targetAmount}
Creator Address: ${creatorAddress}

Respond ONLY with valid JSON (no markdown, no backticks, just pure JSON):
{
  "legitimacyScore": number (0-100),
  "isSuspicious": boolean,
  "flaggedIssues": [list of strings],
  "reasoning": string
}

Be strict but fair. Penalize:
- Vague or poorly written descriptions (-20 points)
- Unrealistic targets or timelines (-15 points)
- Lack of specific details about how funds will be used (-25 points)
- Common fraud indicators like urgency or pressure tactics (-30 points)
- Poor grammar and spelling (-10 points)
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
            content: analysisPrompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Groq API error: ${response.statusText} - ${errorData}`);
    }

    const aiResponse = await response.json();
    const analysisText = aiResponse.choices[0].message.content;

    // Parse JSON from response
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse AI response');
    }

    const analysis = JSON.parse(jsonMatch[0]);

    // Store verification result
    await createAIVerification(campaignId, {
      legitimacy_score: analysis.legitimacyScore,
      is_suspicious: analysis.isSuspicious,
      reasoning: analysis.reasoning,
    });

    // Create suspicious flags if any
    if (analysis.flaggedIssues && analysis.flaggedIssues.length > 0) {
      for (const issue of analysis.flaggedIssues) {
        await createSuspiciousFlag(campaignId, {
          flag_type: 'content_analysis',
          description: issue,
          severity: analysis.isSuspicious ? 'high' : 'medium',
        });
      }
    }

    return NextResponse.json({
      success: true,
      campaignId,
      legitimacyScore: analysis.legitimacyScore,
      isSuspicious: analysis.isSuspicious,
      flaggedIssues: analysis.flaggedIssues,
    });
  } catch (error) {
    console.error('Error verifying campaign:', error);
    return NextResponse.json(
      { error: 'Failed to verify campaign' },
      { status: 500 }
    );
  }
}

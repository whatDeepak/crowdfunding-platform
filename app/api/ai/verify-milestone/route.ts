import { NextRequest, NextResponse } from 'next/server';

const GROQ_API_KEY = process.env.GROQ_API_KEY;

interface MilestoneVerificationRequest {
  campaignId: number;
  milestoneId: number;
  title: string;
  description: string;
  expectedOutcome: string;
  previousMilestones?: Array<{
    title: string;
    description: string;
    completed: boolean;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    if (!GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'AI verification is not configured' },
        { status: 503 }
      );
    }

    const body: MilestoneVerificationRequest = await request.json();
    const {
      campaignId,
      milestoneId,
      title,
      description,
      expectedOutcome,
      previousMilestones = [],
    } = body;

    // Build milestone history context
    const milestoneHistory = previousMilestones
      .map(
        (m, i) =>
          `Milestone ${i + 1}: ${m.title}
      Description: ${m.description}
      Completed: ${m.completed ? 'Yes' : 'No'}`
      )
      .join('\n\n');

    // Create verification prompt
    const verificationPrompt = `
You are an expert at verifying that crowdfunding campaign milestones have been completed as described.
Analyze the milestone and provide a verification assessment.

Campaign ID: ${campaignId}
Milestone ID: ${milestoneId}
Title: ${title}
Description: ${description}
Expected Outcome: ${expectedOutcome}

Previous Milestones:
${milestoneHistory || 'None'}

Respond ONLY with valid JSON:
{
  "isVerifiable": true or false,
  "verificationScore": number 0-100,
  "criteriaClarity": "clear" or "somewhat_clear" or "unclear",
  "redFlags": [list of strings],
  "requiredEvidence": [list of strings],
  "recommendation": string
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
            content: verificationPrompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
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

    return NextResponse.json({
      success: true,
      campaignId,
      milestoneId,
      isVerifiable: analysis.isVerifiable,
      verificationScore: analysis.verificationScore || 75,
      criteriaClarity: analysis.criteriaClarity,
      redFlags: analysis.redFlags || [],
      requiredEvidence: analysis.requiredEvidence || [],
      recommendation: analysis.recommendation,
    });
  } catch (error) {
    console.error('Error verifying milestone:', error);
    return NextResponse.json(
      { error: 'Failed to verify milestone' },
      { status: 500 }
    );
  }
}

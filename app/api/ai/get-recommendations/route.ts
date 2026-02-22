import { NextRequest, NextResponse } from 'next/server';
import { supabase, getUserRecommendations } from '@/lib/supabase';

const GROQ_API_KEY = process.env.GROQ_API_KEY;

interface RecommendationRequest {
  userId: string;
  donationHistory?: Array<{
    campaignId: number;
    amount: number;
    category: string;
  }>;
  preferences?: string[];
}

export async function POST(request: NextRequest) {
  try {
    if (!GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'AI recommendations are not configured' },
        { status: 503 }
      );
    }

    const body: RecommendationRequest = await request.json();
    const { userId, donationHistory = [], preferences = [] } = body;

    // Get user's cached recommendations if recent
    const cachedRecommendations = await getUserRecommendations(userId);
    if (
      cachedRecommendations.length > 0 &&
      new Date(cachedRecommendations[0].created_at).getTime() >
        Date.now() - 24 * 60 * 60 * 1000
    ) {
      return NextResponse.json({
        success: true,
        recommendations: cachedRecommendations,
        source: 'cached',
      });
    }

    // Get all verified campaigns from database
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('visible', true)
      .limit(100);

    if (campaignsError || !campaigns) {
      throw new Error('Failed to fetch campaigns');
    }

    // Build user profile for recommendation
    const donatedCategories = donationHistory
      .map((d) => d.category)
      .filter((c) => c);
    const userProfile = {
      donationCount: donationHistory.length,
      totalDonated: donationHistory.reduce((sum, d) => sum + d.amount, 0),
      favoriteCategories: [...new Set(donatedCategories)],
      interests: preferences,
    };

    // Call AI to get recommendations
    const recommendationPrompt = `
Given the following user profile and available campaigns, recommend the top 5 campaigns that would be most relevant for this user.

User Profile:
- Total Donations: ${userProfile.donationCount}
- Total Amount Donated: $${userProfile.totalDonated}
- Favorite Categories: ${userProfile.favoriteCategories.join(', ') || 'none'}
- Interests: ${userProfile.interests.join(', ') || 'none'}

Available Campaigns:
${campaigns
  .slice(0, 20)
  .map(
    (c) => `
- ID: ${c.campaign_id}
  Title: ${c.title}
  Category: ${c.category || 'general'}
  Description: ${c.description?.substring(0, 150) || 'N/A'}
  Progress: ${c.progress_percentage || 0}%
`
  )
  .join('\n')}

For each recommended campaign, provide ONLY a valid JSON array:
[
  {"campaignId": number, "relevanceScore": number, "reason": string},
  ...5 items
]
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
            content: recommendationPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.statusText}`);
    }

    const aiResponse = await response.json();
    const analysisText = aiResponse.choices[0].message.content;

    const jsonMatch = analysisText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Could not parse AI response');
    }

    const recommendations = JSON.parse(jsonMatch[0]);

    // Store recommendations in database
    for (const rec of recommendations) {
      await supabase.from('user_recommendations').insert([
        {
          user_id: userId,
          campaign_id: rec.campaignId || rec.id,
          relevance_score: rec.relevanceScore || rec.score,
          reason: rec.reason,
          created_at: new Date(),
        },
      ]);
    }

    return NextResponse.json({
      success: true,
      recommendations,
      userProfile,
    });
  } catch (error) {
    console.error('Error generating recommendations:', error);
    return NextResponse.json(
      { error: 'Failed to generate recommendations' },
      { status: 500 }
    );
  }
}

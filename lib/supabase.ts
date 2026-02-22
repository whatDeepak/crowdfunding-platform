
import { createBrowserClient } from '@supabase/ssr';


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;



if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createBrowserClient(supabaseUrl, supabaseKey);

// Database functions
export async function getUser(userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('wallet_address', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching user:', error);
  }
  return data;
}

export async function createUser(walletAddress: string) {
  const { data, error } = await supabase
    .from('users')
    .insert([
      {
        wallet_address: walletAddress,
        created_at: new Date(),
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Error creating user:', error);
  }
  return data;
}

export async function getCampaignMetadata(campaignId: number) {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('campaign_id', campaignId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching campaign metadata:', error);
  }
  return data;
}

export async function createCampaignMetadata(campaignId: number, metadata: any) {
  const { data, error } = await supabase
    .from('campaigns')
    .insert([
      {
        campaign_id: campaignId,
        ...metadata,
        created_at: new Date(),
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Error creating campaign metadata:', error);
  }
  return data;
}

export async function getAIVerification(campaignId: number) {
  const { data, error } = await supabase
    .from('ai_verifications')
    .select('*')
    .eq('campaign_id', campaignId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching AI verification:', error);
  }
  return data;
}

export async function createAIVerification(campaignId: number, verification: any) {
  const { data, error } = await supabase
    .from('ai_verifications')
    .insert([
      {
        campaign_id: campaignId,
        ...verification,
        created_at: new Date(),
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Error creating AI verification:', error);
  }
  return data;
}

export async function getUserRecommendations(userId: string) {
  const { data, error } = await supabase
    .from('user_recommendations')
    .select('*')
    .eq('user_id', userId)
    .order('relevance_score', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching recommendations:', error);
  }
  return data || [];
}

export async function recordDonation(campaignId: number, donor: string, amount: string, txHash: string) {
  const { data, error } = await supabase
    .from('donations')
    .insert([
      {
        campaign_id: campaignId,
        donor_address: donor,
        amount,
        tx_hash: txHash,
        created_at: new Date(),
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Error recording donation:', error);
  }
  return data;
}

export async function getSuspiciousFlags(campaignId: number) {
  const { data, error } = await supabase
    .from('suspicious_flags')
    .select('*')
    .eq('campaign_id', campaignId);

  if (error) {
    console.error('Error fetching suspicious flags:', error);
  }
  return data || [];
}

export async function createSuspiciousFlag(campaignId: number, flag: any) {
  const { data, error } = await supabase
    .from('suspicious_flags')
    .insert([
      {
        campaign_id: campaignId,
        ...flag,
        created_at: new Date(),
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Error creating suspicious flag:', error);
  }
  return data;
}

export async function getAllCampaignsMetadata(limit = 20, offset = 0) {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching campaigns:', error);
  }
  return data || [];
}

export async function searchCampaigns(query: string, limit = 20) {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error searching campaigns:', error);
  }
  return data || [];
}

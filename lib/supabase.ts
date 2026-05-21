import { createClient } from '@supabase/supabase-js';
import type {
  DbUser,
  DbCampaign,
  DbMilestone,
  DbWithdrawalRequest,
  DbVerifierEndorsement,
  DbVerificationRequest,
  DbDonation,
  DbAiVerification,
  DbAdminAction,
  DbOrganization,
  CampaignAnalysisResult,
  ProofAnalysisResult,
  CampaignCategory,
  MilestoneDbStatus,
  OrgStatus,
  VerificationRequestStatus,
} from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Use service role key server-side (bypasses RLS); fall back to publishable key
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// ─────────────────────────────────────────────────────────────────────────────
// Users
// ─────────────────────────────────────────────────────────────────────────────

export async function getUser(walletAddress: string): Promise<DbUser | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('wallet_address', walletAddress.toLowerCase())
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('getUser error:', error);
  }
  return data;
}

export async function upsertUser(walletAddress: string): Promise<DbUser | null> {
  const { data, error } = await supabase
    .from('users')
    .upsert(
      { wallet_address: walletAddress.toLowerCase() },
      { onConflict: 'wallet_address', ignoreDuplicates: true }
    )
    .select()
    .single();

  if (error) console.error('upsertUser error:', error);
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Campaigns
// ─────────────────────────────────────────────────────────────────────────────

export async function getCampaign(id: string): Promise<DbCampaign | null> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') console.error('getCampaign error:', error);
  return data;
}

export async function getCampaignByContractId(contractId: number): Promise<DbCampaign | null> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('contract_id', contractId)
    .single();

  if (error && error.code !== 'PGRST116') console.error('getCampaignByContractId error:', error);
  return data;
}

export async function getActiveCampaigns(
  limit = 20,
  offset = 0,
  category?: CampaignCategory
): Promise<DbCampaign[]> {
  let query = supabase
    .from('campaigns')
    .select('*')
    .in('status', ['active', 'funded'])
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (category) query = query.eq('category', category);

  const { data, error } = await query;
  if (error) console.error('getActiveCampaigns error:', error);
  return data ?? [];
}

export async function searchCampaigns(query: string, limit = 20): Promise<DbCampaign[]> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .in('status', ['active', 'funded'])
    .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
    .order('ai_trust_score', { ascending: false })
    .limit(limit);

  if (error) console.error('searchCampaigns error:', error);
  return data ?? [];
}

export async function getCreatorCampaigns(walletAddress: string): Promise<DbCampaign[]> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('creator_wallet', walletAddress.toLowerCase())
    .order('created_at', { ascending: false });

  if (error) console.error('getCreatorCampaigns error:', error);
  return data ?? [];
}

export async function createCampaign(campaign: Omit<DbCampaign, 'id' | 'created_at' | 'updated_at'>): Promise<DbCampaign | null> {
  const { data, error } = await supabase
    .from('campaigns')
    .insert([{ ...campaign, creator_wallet: campaign.creator_wallet.toLowerCase() }])
    .select()
    .single();

  if (error) console.error('createCampaign error:', error);
  return data;
}

export async function updateCampaignContractId(id: string, contractId: number): Promise<void> {
  const { error } = await supabase
    .from('campaigns')
    .update({ contract_id: contractId, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) console.error('updateCampaignContractId error:', error);
}

export async function updateCampaignStatus(
  id: string,
  status: DbCampaign['status'],
  extra?: Partial<DbCampaign>
): Promise<void> {
  const { error } = await supabase
    .from('campaigns')
    .update({ status, ...extra, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) console.error('updateCampaignStatus error:', error);
}

/** Store AI analysis result back onto the campaign row (caches the score). */
export async function saveCampaignAiResult(
  id: string,
  result: CampaignAnalysisResult
): Promise<void> {
  const { error } = await supabase
    .from('campaigns')
    .update({
      ai_trust_score:      result.trustScore,
      ai_risk_level:       result.riskLevel,
      ai_flags:            result.flags,
      ai_explanation:      result.explanation,
      ai_text_score:       result.textScore,
      ai_semantic_score:   result.semanticScore,
      ai_amount_score:     result.amountScore,
      ai_image_score:      result.imageScore,
      ai_document_score:   result.documentAlignmentScore,
      ai_document_flags:   result.documentFlags ?? [],
      last_analysis_at:    new Date().toISOString(),
      embedding:           result.embedding.length > 0 ? result.embedding : null,
      updated_at:          new Date().toISOString(),
    })
    .eq('id', id);

  if (error) console.error('saveCampaignAiResult error:', error);
}

/** Fetch embeddings of all active campaigns for duplicate detection. */
export async function getAllCampaignEmbeddings(): Promise<
  Array<{ id: string; embedding: number[] | null }>
> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('id, embedding')
    .in('status', ['active', 'funded', 'pending_verification', 'pending_review']);

  if (error) console.error('getAllCampaignEmbeddings error:', error);
  return (data ?? []) as Array<{ id: string; embedding: number[] | null }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Milestones
// ─────────────────────────────────────────────────────────────────────────────

export async function getMilestones(campaignId: string): Promise<DbMilestone[]> {
  const { data, error } = await supabase
    .from('milestones')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('sequence_order', { ascending: true });

  if (error) console.error('getMilestones error:', error);
  return data ?? [];
}

export async function createMilestone(
  milestone: Omit<DbMilestone, 'id' | 'created_at'>
): Promise<DbMilestone | null> {
  const { data, error } = await supabase
    .from('milestones')
    .insert([milestone])
    .select()
    .single();

  if (error) console.error('createMilestone error:', error);
  return data;
}

export async function updateMilestoneStatus(milestoneId: string, status: MilestoneDbStatus): Promise<void> {
  const { error } = await supabase
    .from('milestones')
    .update({ status })
    .eq('id', milestoneId);
  if (error) console.error('updateMilestoneStatus error:', error);
}

export async function deleteCampaign(campaignId: string): Promise<void> {
  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', campaignId);
  if (error) console.error('deleteCampaign error:', error);
}

// ─────────────────────────────────────────────────────────────────────────────
// Withdrawal requests
// ─────────────────────────────────────────────────────────────────────────────

export async function getWithdrawalRequestById(id: string): Promise<DbWithdrawalRequest | null> {
  const { data, error } = await supabase
    .from('withdrawal_requests')
    .select('*')
    .eq('id', id)
    .single();
  if (error) console.error('getWithdrawalRequestById error:', error);
  return data ?? null;
}

export async function getWithdrawalRequests(campaignId: string): Promise<DbWithdrawalRequest[]> {
  const { data, error } = await supabase
    .from('withdrawal_requests')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });

  if (error) console.error('getWithdrawalRequests error:', error);
  return data ?? [];
}

export async function getAllPendingWithdrawals(): Promise<DbWithdrawalRequest[]> {
  const { data, error } = await supabase
    .from('withdrawal_requests')
    .select('*, campaigns(title, creator_wallet, category, contract_id)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) console.error('getAllPendingWithdrawals error:', error);
  return data ?? [];
}

export async function createWithdrawalRequest(
  req: Omit<DbWithdrawalRequest, 'id' | 'created_at'>
): Promise<DbWithdrawalRequest | null> {
  const { data, error } = await supabase
    .from('withdrawal_requests')
    .insert([req])
    .select()
    .single();

  if (error) console.error('createWithdrawalRequest error:', error);
  return data;
}

export async function saveWithdrawalAiResult(
  id: string,
  result: ProofAnalysisResult
): Promise<void> {
  const { error } = await supabase
    .from('withdrawal_requests')
    .update({
      ai_consistency_score: result.consistencyScore,
      ai_recommendation:    result.aiRecommendation,
      ai_admin_note:        result.adminNote,
    })
    .eq('id', id);

  if (error) console.error('saveWithdrawalAiResult error:', error);
}

export async function updateWithdrawalStatus(
  id: string,
  status: 'approved' | 'rejected',
  extra?: { rejection_reason?: string; admin_tx_hash?: string }
): Promise<void> {
  const { error } = await supabase
    .from('withdrawal_requests')
    .update({ status, reviewed_at: new Date().toISOString(), ...extra })
    .eq('id', id);

  if (error) console.error('updateWithdrawalStatus error:', error);
}

// ─────────────────────────────────────────────────────────────────────────────
// Verifier endorsements
// ─────────────────────────────────────────────────────────────────────────────

export async function getEndorsements(campaignId: string): Promise<DbVerifierEndorsement[]> {
  const { data, error } = await supabase
    .from('verifier_endorsements')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });

  if (error) console.error('getEndorsements error:', error);
  return data ?? [];
}

export async function createEndorsement(
  endorsement: Omit<DbVerifierEndorsement, 'id' | 'created_at'>
): Promise<DbVerifierEndorsement | null> {
  const { data, error } = await supabase
    .from('verifier_endorsements')
    .insert([{ ...endorsement, verifier_wallet: endorsement.verifier_wallet.toLowerCase() }])
    .select()
    .single();

  if (error) console.error('createEndorsement error:', error);
  return data;
}

/** Campaigns in the verification queue for a verifier's category. */
export async function getVerificationQueue(category?: CampaignCategory): Promise<DbCampaign[]> {
  let query = supabase
    .from('campaigns')
    .select('*')
    .eq('status', 'pending_verification')
    .order('created_at', { ascending: true });

  if (category) query = query.eq('category', category);

  const { data, error } = await query;
  if (error) console.error('getVerificationQueue error:', error);
  return data ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Donations
// ─────────────────────────────────────────────────────────────────────────────

export async function getDonations(campaignId: string): Promise<DbDonation[]> {
  const { data, error } = await supabase
    .from('donations')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });

  if (error) console.error('getDonations error:', error);
  return data ?? [];
}

export async function getDonorHistory(walletAddress: string): Promise<DbDonation[]> {
  const { data, error } = await supabase
    .from('donations')
    .select('*, campaigns(id, title, status, contract_id, image_url, ai_trust_score)')
    .eq('donor_wallet', walletAddress.toLowerCase())
    .order('created_at', { ascending: false });

  if (error) console.error('getDonorHistory error:', error);
  return data ?? [];
}

export async function recordDonation(
  donation: Omit<DbDonation, 'id' | 'created_at'>
): Promise<DbDonation | null> {
  const { data, error } = await supabase
    .from('donations')
    .insert([{ ...donation, donor_wallet: donation.donor_wallet.toLowerCase() }])
    .select()
    .single();

  if (error) { console.error('recordDonation error:', error); return null; }

  // Increment current_amount_eth on the campaign
  if (data && donation.status === 'confirmed') {
    const { data: camp } = await supabase
      .from('campaigns')
      .select('current_amount_eth, target_amount_eth, status')
      .eq('id', donation.campaign_id)
      .single();

    if (camp) {
      const newAmount = (camp.current_amount_eth ?? 0) + donation.amount_eth;
      const newStatus = newAmount >= camp.target_amount_eth && camp.status === 'active' ? 'funded' : camp.status;
      await supabase
        .from('campaigns')
        .update({ current_amount_eth: newAmount, status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', donation.campaign_id);
    }
  }

  return data;
}

export async function updateDonationStatus(
  txHash: string,
  status: 'confirmed' | 'failed',
  blockNumber?: number
): Promise<void> {
  const { error } = await supabase
    .from('donations')
    .update({ status, block_number: blockNumber })
    .eq('transaction_hash', txHash);

  if (error) console.error('updateDonationStatus error:', error);
}

// ─────────────────────────────────────────────────────────────────────────────
// AI verifications (raw pipeline results log)
// ─────────────────────────────────────────────────────────────────────────────

export async function logAiVerification(
  record: Omit<DbAiVerification, 'id' | 'created_at'>
): Promise<void> {
  const { error } = await supabase.from('ai_verifications').insert([record]);
  if (error) console.error('logAiVerification error:', error);
}

// ─────────────────────────────────────────────────────────────────────────────
// Image hashes (for duplicate detection)
// ─────────────────────────────────────────────────────────────────────────────

export async function getAllImageHashes(): Promise<string[]> {
  const { data, error } = await supabase
    .from('image_hashes')
    .select('phash');

  if (error) console.error('getAllImageHashes error:', error);
  return (data ?? []).map((row) => row.phash as string);
}

export async function saveImageHash(campaignId: string, phash: string, imageUrl?: string): Promise<void> {
  const { error } = await supabase
    .from('image_hashes')
    .insert([{ campaign_id: campaignId, phash, image_url: imageUrl }]);

  if (error) console.error('saveImageHash error:', error);
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin actions (audit log)
// ─────────────────────────────────────────────────────────────────────────────

export async function logAdminAction(
  action: Omit<DbAdminAction, 'id' | 'created_at'>
): Promise<void> {
  const { error } = await supabase
    .from('admin_actions')
    .insert([{ ...action, admin_wallet: action.admin_wallet.toLowerCase() }]);

  if (error) console.error('logAdminAction error:', error);
}

export async function getAdminActions(limit = 50): Promise<DbAdminAction[]> {
  const { data, error } = await supabase
    .from('admin_actions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) console.error('getAdminActions error:', error);
  return data ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin campaign queues
// ─────────────────────────────────────────────────────────────────────────────

export async function getAdminReviewQueue(): Promise<DbCampaign[]> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('status', 'pending_review')
    .order('created_at', { ascending: true });

  if (error) console.error('getAdminReviewQueue error:', error);
  return data ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Organizations
// ─────────────────────────────────────────────────────────────────────────────

export async function createOrganization(
  org: Omit<DbOrganization, 'id' | 'created_at' | 'updated_at' | 'total_endorsements' | 'campaigns_gone_live' | 'tier' | 'status'>
): Promise<DbOrganization | null> {
  const { data, error } = await supabase
    .from('organizations')
    .insert([{ ...org, tier: 2, status: 'pending_approval', total_endorsements: 0, campaigns_gone_live: 0 }])
    .select()
    .single();

  if (error) console.error('createOrganization error:', error);
  return data;
}

export async function getOrganizationByUserId(userId: string): Promise<DbOrganization | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') console.error('getOrganizationByUserId error:', error);
  return data;
}

export async function getOrganizationByWallet(walletAddress: string): Promise<DbOrganization | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('wallet_address', walletAddress.toLowerCase())
    .single();

  if (error && error.code !== 'PGRST116') console.error('getOrganizationByWallet error:', error);
  return data;
}

export async function getOrganizations(status?: OrgStatus): Promise<DbOrganization[]> {
  let query = supabase
    .from('organizations')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) console.error('getOrganizations error:', error);
  return data ?? [];
}

export async function getActiveOrganizationsForCategory(
  category: CampaignCategory
): Promise<DbOrganization[]> {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('status', 'active')
    .contains('domains', [category])
    .order('tier', { ascending: true })
    .order('total_endorsements', { ascending: false });

  if (error) console.error('getActiveOrganizationsForCategory error:', error);
  return data ?? [];
}

export async function updateOrganizationStatus(
  id: string,
  status: OrgStatus,
  extra?: Partial<DbOrganization>
): Promise<void> {
  const { error } = await supabase
    .from('organizations')
    .update({ status, ...extra, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) console.error('updateOrganizationStatus error:', error);
}

// ─────────────────────────────────────────────────────────────────────────────
// Verification requests
// ─────────────────────────────────────────────────────────────────────────────

export async function createVerificationRequest(req: {
  campaign_id:     string;
  organization_id: string;
  creator_note?:   string;
}): Promise<DbVerificationRequest | null> {
  const { data, error } = await supabase
    .from('verification_requests')
    .insert([{ ...req, status: 'pending' }])
    .select()
    .single();

  if (error) console.error('createVerificationRequest error:', error);
  return data;
}

export async function getVerificationRequests(params: {
  campaignId?:     string;
  organizationId?: string;
  status?:         VerificationRequestStatus;
}): Promise<DbVerificationRequest[]> {
  let query = supabase
    .from('verification_requests')
    .select('*, organizations(org_name, org_type, tier, domains)')
    .order('created_at', { ascending: false });

  if (params.campaignId)     query = query.eq('campaign_id', params.campaignId);
  if (params.organizationId) query = query.eq('organization_id', params.organizationId);
  if (params.status)         query = query.eq('status', params.status);

  const { data, error } = await query;
  if (error) console.error('getVerificationRequests error:', error);
  return data ?? [];
}

export async function updateVerificationRequest(
  id: string,
  status: VerificationRequestStatus,
  decline_reason?: string
): Promise<void> {
  const { error } = await supabase
    .from('verification_requests')
    .update({ status, decline_reason, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) console.error('updateVerificationRequest error:', error);
}

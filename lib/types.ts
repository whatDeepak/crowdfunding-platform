// ─────────────────────────────────────────────────────────────────────────────
// On-chain enums (mirror Solidity contract)
// ─────────────────────────────────────────────────────────────────────────────

export enum CampaignStatus {
  Active    = 0,
  Funded    = 1,
  Completed = 2,
  Cancelled = 3,
}

export enum RequestStatus {
  Pending  = 0,
  Approved = 1,
  Rejected = 2,
}

// ─────────────────────────────────────────────────────────────────────────────
// On-chain structs (returned from ethers contract calls)
// ─────────────────────────────────────────────────────────────────────────────

export interface OnChainCampaign {
  id:               bigint;
  creator:          string;     // wallet address
  targetAmount:     bigint;     // wei
  amountRaised:     bigint;     // wei
  deadline:         bigint;     // unix timestamp
  status:           CampaignStatus;
  ipfsMetadataHash: string;     // IPFS CID
  createdAt:        bigint;     // unix timestamp
}

export interface OnChainWithdrawalRequest {
  id:               bigint;
  campaignId:       bigint;
  requestedAmount:  bigint;     // wei
  proofIpfsHash:    string;     // IPFS CID of proof bundle
  status:           RequestStatus;
  rejectionReason:  string;
  createdAt:        bigint;     // unix timestamp
}

// ─────────────────────────────────────────────────────────────────────────────
// Off-chain DB types (Supabase rows)
// ─────────────────────────────────────────────────────────────────────────────

export type CampaignDbStatus =
  | 'pending_ai'
  | 'pending_verification'
  | 'pending_review'
  | 'needs_more_proof'
  | 'active'
  | 'funded'
  | 'completed'
  | 'cancelled'
  | 'rejected';

export type MilestoneDbStatus =
  | 'pending'
  | 'withdrawal_requested'
  | 'released'
  | 'rejected';

export type WithdrawalDbStatus = 'pending' | 'approved' | 'rejected';

export type AiRiskLevel   = 'low' | 'medium' | 'high';
export type AiReco        = 'approve' | 'flag' | 'reject';
export type DonationStatus = 'pending' | 'confirmed' | 'failed';
export type UserType      = 'donor' | 'creator' | 'verifier' | 'admin';
export type CampaignCategory = 'medical' | 'education' | 'disaster' | 'community';
export type OrgStatus    = 'pending_approval' | 'more_info_needed' | 'active' | 'suspended' | 'rejected';
export type OrgType      = 'hospital' | 'ngo' | 'university' | 'pharmacy' | 'legal_aid' | 'other';
export type GeographicScope = 'local' | 'state' | 'national' | 'international';

export interface DbOrganization {
  id:                     string;
  user_id:                string;
  wallet_address?:        string;
  org_name:               string;
  org_type:               OrgType;
  registration_number:    string;
  registration_doc_ipfs?: string;
  website_url?:           string;
  contact_email?:         string;
  responsible_person:     string;
  geographic_scope:       GeographicScope;
  domains:                CampaignCategory[];
  tier:                   number;
  status:                 OrgStatus;
  suspension_reason?:     string;
  admin_notes?:           string;
  total_endorsements:     number;
  campaigns_gone_live:    number;
  approved_at?:           string;
  approved_by?:           string;
  created_at:             string;
  updated_at:             string;
}

export interface DbUser {
  id:                string;
  auth_id?:          string;        // Supabase auth.users UUID
  wallet_address?:   string;        // connected MetaMask wallet (nullable — set from profile)
  email?:            string;
  full_name?:        string;
  user_type:         UserType;
  verifier_org_name?: string;       // deprecated — use organizations table
  verifier_category?: CampaignCategory;
  is_active:         boolean;
  created_at:        string;
  updated_at:        string;
}

export interface DbCampaign {
  id:                  string;
  contract_id?:        number;
  creator_wallet:      string;
  title:               string;
  description:         string;
  category:            CampaignCategory;
  image_url?:          string;
  target_amount_eth:   number;
  current_amount_eth:  number;
  status:              CampaignDbStatus;
  deadline?:           string;
  ipfs_metadata_hash?: string;
  ai_trust_score?:     number;
  ai_risk_level?:      AiRiskLevel;
  ai_flags?:           string[];
  ai_explanation?:     string;
  ai_text_score?:      number;
  ai_semantic_score?:  number;
  ai_amount_score?:    number;
  ai_image_score?:     number;
  ai_document_score?:  number;
  ai_document_flags?:  string[];
  analysis_version?:   number;
  last_analysis_at?:   string;
  embedding?:          number[];
  platform_approved:   boolean;
  created_at:          string;
  updated_at:          string;
}

export interface DbMilestone {
  id:                   string;
  campaign_id:          string;
  contract_milestone_id?: number;
  title:                string;
  description?:         string;
  target_amount_eth:    number;
  sequence_order:       number;
  expected_proof_types?: string;
  status:               MilestoneDbStatus;
  created_at:           string;
}

export interface DbWithdrawalRequest {
  id:                   string;
  campaign_id:          string;
  milestone_id?:        string;
  contract_request_id?: number;
  requested_amount_eth: number;
  proof_ipfs_hash:      string;
  proof_description?:   string;
  ai_consistency_score?: number;
  ai_recommendation?:   AiReco;
  ai_admin_note?:       string;
  status:               WithdrawalDbStatus;
  rejection_reason?:    string;
  admin_tx_hash?:       string;
  reviewed_at?:         string;
  created_at:           string;
}

export interface DbVerifierEndorsement {
  id:                      string;
  campaign_id:             string;
  organization_id:         string;
  verifier_wallet:         string;
  verifier_org_name:       string;
  org_tier:                number;
  corroborating_doc_ipfs?: string;
  endorsement_note?:       string;
  is_revoked:              boolean;
  revoked_by?:             string;
  revoked_at?:             string;
  revoked_reason?:         string;
  created_at:              string;
}

export type VerificationRequestStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'expired';

export interface DbVerificationRequest {
  id:               string;
  campaign_id:      string;
  organization_id:  string;
  creator_note?:    string;
  status:           VerificationRequestStatus;
  decline_reason?:  string;
  expires_at:       string;
  created_at:       string;
  updated_at:       string;
  // Joined fields (returned by some queries)
  organizations?:   Pick<DbOrganization, 'org_name' | 'org_type' | 'tier' | 'domains'>;
}

export interface DbDonation {
  id:               string;
  campaign_id:      string;
  donor_wallet:     string;
  amount_eth:       number;
  transaction_hash: string;
  block_number?:    number;
  status:           DonationStatus;
  created_at:       string;
}

export interface DbAiVerification {
  id:               string;
  campaign_id?:     string;
  withdrawal_id?:   string;
  verification_type: 'campaign_analysis' | 'proof_analysis';
  text_score?:      number;
  semantic_score?:  number;
  amount_score?:    number;
  image_reuse_flag: boolean;
  final_score?:     number;
  risk_level?:      AiRiskLevel;
  flags?:           string[];
  explanation?:     string;
  raw_response?:    Record<string, unknown>;
  created_at:       string;
}

export interface DbAdminAction {
  id:           string;
  admin_wallet: string;
  action_type:  string;
  target_id:    string;
  target_type:  'campaign' | 'withdrawal_request';
  reason?:      string;
  tx_hash?:     string;
  created_at:   string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Composite / UI types
// ─────────────────────────────────────────────────────────────────────────────

/** Campaign as displayed in the UI — DB record merged with endorsements */
export interface CampaignWithDetails extends DbCampaign {
  milestones?:    DbMilestone[];
  endorsements?:  DbVerifierEndorsement[];
  donationCount?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI pipeline types (request / response between Next.js ↔ HF Spaces service)
// ─────────────────────────────────────────────────────────────────────────────

export interface CampaignAnalysisRequest {
  title:          string;
  description:    string;
  targetAmountEth: number;
  category:       CampaignCategory;
  documentNames?: string[];           // filenames of uploaded docs
  existingEmbeddings?: number[][];    // embeddings of all active campaigns
  existingImageHashes?: string[];     // pHash strings of existing campaign images
  imageUrl?:      string;
}

export interface CampaignAnalysisResult {
  trustScore:              number;    // 0–100 combined
  riskLevel:               AiRiskLevel;
  textScore:               number;   // 0–25 (raw, displayed scaled to /20)
  semanticScore:           number;   // 0–25 (raw, displayed scaled to /15)
  amountScore:             number;   // 0–25 (raw, displayed scaled to /15)
  imageScore:              number;   // 0–25 (raw, displayed scaled to /10)
  documentAlignmentScore:  number;   // 0–40 — story-vs-proof entity matching
  imageReuseFlag:          boolean;  // pHash match
  isAiGenerated:           boolean;  // Groq Vision deepfake verdict
  isStockPhoto:            boolean;
  visionDescription:       string;   // what Groq Vision saw
  documentFlags:           string[]; // entity contradiction / timeline flags
  flags:                   string[]; // all flags combined
  explanation:             string;
  embedding:               number[]; // 384-dim MiniLM vector
}

export interface ProofAnalysisRequest {
  milestoneTitle:  string;
  milestoneAmount: number;
  proofDescription: string;
  documentNames:   string[];
  campaignTitle:   string;
  campaignCategory: CampaignCategory;
  previousMilestones?: Array<{ title: string; status: string }>;
}

export interface ProofAnalysisResult {
  consistencyScore:  number;          // 0–100
  aiRecommendation:  AiReco;
  flags:             string[];
  adminNote:         string;
}

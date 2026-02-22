export enum CampaignStatus {
  Active = 0,
  Completed = 1,
  Cancelled = 2,
  Funded = 3,
}

export enum MilestoneStatus {
  Pending = 0,
  Completed = 1,
  Verified = 2,
  Failed = 3,
}

export interface Campaign {
  id: bigint;
  creator: string;
  title: string;
  description: string;
  targetAmount: bigint;
  deadline: bigint;
  amountRaised: bigint;
  status: CampaignStatus;
  ipfsHash: string;
  createdAt: bigint;
}

export interface Milestone {
  id: bigint;
  campaignId: bigint;
  title: string;
  description: string;
  releaseAmount: bigint;
  deadline: bigint;
  status: MilestoneStatus;
  votes: bigint;
  totalVoters: bigint;
}

export interface Donation {
  id: bigint;
  campaignId: bigint;
  donor: string;
  amount: bigint;
  timestamp: bigint;
  refunded: boolean;
}

export interface CampaignWithMetadata extends Campaign {
  aiLegitimacyScore?: number;
  suspiciousFlags?: string[];
  recommendationScore?: number;
  milestoneCount?: number;
}

export interface AIVerificationResult {
  campaignId: number;
  legitimacyScore: number; // 0-100
  isSuspicious: boolean;
  flaggedIssues: string[];
  createdAt: Date;
}

export interface UserRecommendation {
  campaignId: number;
  relevanceScore: number;
  reason: string;
}

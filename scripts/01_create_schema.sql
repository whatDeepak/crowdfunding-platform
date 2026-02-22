-- Crowdfunding Platform Database Schema

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(42) UNIQUE NOT NULL,
  email VARCHAR(255),
  full_name VARCHAR(255),
  avatar_url TEXT,
  bio TEXT,
  user_type VARCHAR(50) DEFAULT 'donor', -- 'donor' or 'creator'
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create creators table
CREATE TABLE IF NOT EXISTS creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  wallet_address VARCHAR(42) UNIQUE NOT NULL,
  total_raised NUMERIC(20, 2) DEFAULT 0,
  campaigns_count INTEGER DEFAULT 0,
  reputation_score NUMERIC(5, 2) DEFAULT 0,
  kyc_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id VARCHAR(255) UNIQUE NOT NULL, -- on-chain campaign ID
  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
  wallet_address VARCHAR(42) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(100),
  image_url TEXT,
  target_amount NUMERIC(20, 2) NOT NULL,
  current_amount NUMERIC(20, 2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'ETH',
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'completed', 'failed', 'canceled'
  start_date TIMESTAMP NOT NULL,
  deadline TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_amounts CHECK (current_amount >= 0 AND target_amount > 0)
);

-- Create milestones table
CREATE TABLE IF NOT EXISTS milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  release_percentage NUMERIC(5, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'completed', 'verified'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create donations table
CREATE TABLE IF NOT EXISTS donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  donor_wallet_address VARCHAR(42) NOT NULL,
  amount NUMERIC(20, 2) NOT NULL,
  transaction_hash VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(50) DEFAULT 'confirmed', -- 'pending', 'confirmed', 'failed'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create AI verifications table
CREATE TABLE IF NOT EXISTS ai_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  verification_type VARCHAR(100), -- 'legitimacy_score', 'suspicious_content', 'milestone_verification'
  score NUMERIC(5, 2),
  is_flagged BOOLEAN DEFAULT FALSE,
  details JSONB,
  verified_at TIMESTAMP DEFAULT NOW()
);

-- Create campaign legitimacy scores
CREATE TABLE IF NOT EXISTS campaign_legitimacy_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  score NUMERIC(5, 2) NOT NULL, -- 0-100
  risk_level VARCHAR(50), -- 'low', 'medium', 'high'
  analysis JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create user recommendations table
CREATE TABLE IF NOT EXISTS user_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  relevance_score NUMERIC(5, 2), -- 0-100
  reason VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create suspicious content flags table
CREATE TABLE IF NOT EXISTS suspicious_content_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  flag_type VARCHAR(100), -- 'phishing', 'fraud', 'spam', 'inappropriate'
  confidence NUMERIC(5, 2),
  details TEXT,
  flagged_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_campaigns_creator_id ON campaigns(creator_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_deadline ON campaigns(deadline);
CREATE INDEX idx_donations_campaign_id ON donations(campaign_id);
CREATE INDEX idx_donations_donor ON donations(donor_wallet_address);
CREATE INDEX idx_milestones_campaign_id ON milestones(campaign_id);
CREATE INDEX idx_ai_verifications_campaign_id ON ai_verifications(campaign_id);
CREATE INDEX idx_user_recommendations_user_id ON user_recommendations(user_id);
CREATE INDEX idx_suspicious_flags_campaign_id ON suspicious_content_flags(campaign_id);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for public read access to campaigns
CREATE POLICY "Campaigns are publicly readable" ON campaigns
  FOR SELECT USING (status IN ('active', 'completed', 'failed'));

-- Create RLS policies for users to read their own data
CREATE POLICY "Users can read their own profile" ON users
  FOR SELECT USING (wallet_address = current_setting('request.jwt.claims', true)::jsonb->>'wallet_address');

-- Create RLS policies for donations to be readable by campaign creator and donor
CREATE POLICY "Donations readable by creator and donor" ON donations
  FOR SELECT USING (
    donor_wallet_address = current_setting('request.jwt.claims', true)::jsonb->>'wallet_address' OR
    campaign_id IN (
      SELECT id FROM campaigns WHERE wallet_address = current_setting('request.jwt.claims', true)::jsonb->>'wallet_address'
    )
  );

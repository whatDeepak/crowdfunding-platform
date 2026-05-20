-- ============================================================
-- Migration 03: Auth System + Organization Ecosystem
-- Run in Supabase SQL editor (safe to run on existing data)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Update users table for Supabase Auth
-- ────────────────────────────────────────────────────────────

-- Add auth_id column linking to auth.users
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add email column (synced from auth.users on signup)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email varchar(255);

-- wallet_address must be nullable — email-auth users don't have a wallet at signup time
ALTER TABLE users ALTER COLUMN wallet_address DROP NOT NULL;

-- Full unique constraint on auth_id (not partial — partial indexes break ON CONFLICT)
-- Multiple NULLs are allowed by PostgreSQL UNIQUE constraints, so nullable auth_id is safe.
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_auth_id_unique UNIQUE (auth_id);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- ────────────────────────────────────────────────────────────
-- 2. DB trigger: auto-create users row on auth signup
-- ────────────────────────────────────────────────────────────

-- Grant insert permission so the SECURITY DEFINER function can write even with RLS enabled
GRANT INSERT ON public.users TO postgres;

CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (auth_id, email, full_name, user_type, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'donor',
    true
  )
  ON CONFLICT (auth_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_auth_user();

-- ────────────────────────────────────────────────────────────
-- 3. Add needs_more_proof to campaign status enum
-- ────────────────────────────────────────────────────────────
-- Postgres doesn't support ADD VALUE IF NOT EXISTS before 9.x,
-- but it's safe to run on Supabase (Postgres 15+).

DO $$ BEGIN
  ALTER TYPE campaign_status_enum ADD VALUE IF NOT EXISTS 'needs_more_proof' BEFORE 'active';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ────────────────────────────────────────────────────────────
-- 4. Add new AI signal columns to campaigns
-- ────────────────────────────────────────────────────────────

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ai_text_score     integer;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ai_semantic_score integer;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ai_amount_score   integer;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ai_image_score    integer;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ai_document_score integer;  -- 0-40, new
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ai_document_flags jsonb;    -- entity contradictions
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS analysis_version  integer DEFAULT 1;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS last_analysis_at  timestamp;

-- ────────────────────────────────────────────────────────────
-- 5. organizations table
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organizations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address       varchar(42),       -- connected wallet for endorsement signing
  org_name             varchar(200) NOT NULL,
  org_type             varchar(50)  NOT NULL,  -- hospital | ngo | educational | pharmacy | legal | other
  registration_number  varchar(100),
  registration_doc_ipfs varchar(255),    -- IPFS CID of uploaded certificate
  website_url          varchar(500),
  contact_email        varchar(255),
  responsible_person   varchar(200),     -- "Dr. Priya Menon, Medical Director"
  geographic_scope     varchar(20) DEFAULT 'state',  -- local | state | national | international
  domains              jsonb NOT NULL DEFAULT '[]',  -- ['medical', 'disaster', ...]
  tier                 integer DEFAULT 2,            -- 1=institutional, 2=registered
  status               varchar(30) DEFAULT 'pending_approval',  -- pending_approval | active | suspended | revoked | more_info_needed
  suspension_reason    text,
  admin_notes          text,              -- internal, not shown to org
  total_endorsements   integer DEFAULT 0,
  campaigns_gone_live  integer DEFAULT 0,
  approved_at          timestamp,
  approved_by          varchar(42),      -- admin wallet
  created_at           timestamp DEFAULT now(),
  updated_at           timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS orgs_user_id_idx ON organizations(user_id) WHERE user_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 6. Upgrade verifier_endorsements
-- ────────────────────────────────────────────────────────────

ALTER TABLE verifier_endorsements ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);
ALTER TABLE verifier_endorsements ADD COLUMN IF NOT EXISTS org_tier       integer DEFAULT 2;
ALTER TABLE verifier_endorsements ADD COLUMN IF NOT EXISTS is_revoked     boolean DEFAULT false;
ALTER TABLE verifier_endorsements ADD COLUMN IF NOT EXISTS revoked_by     varchar(42);
ALTER TABLE verifier_endorsements ADD COLUMN IF NOT EXISTS revoked_at     timestamp;
ALTER TABLE verifier_endorsements ADD COLUMN IF NOT EXISTS revoked_reason text;

-- Ensure one endorsement per org per campaign
CREATE UNIQUE INDEX IF NOT EXISTS endorsements_org_campaign_idx
  ON verifier_endorsements(campaign_id, organization_id)
  WHERE organization_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 7. verification_requests table
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS verification_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid REFERENCES campaigns(id) ON DELETE CASCADE NOT NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  creator_note    text,
  status          varchar(20) DEFAULT 'pending',  -- pending | accepted | declined | withdrawn | expired
  decline_reason  text,
  invited_via_link boolean DEFAULT false,
  invite_token    varchar(64),
  expires_at      timestamp DEFAULT (now() + interval '7 days'),
  created_at      timestamp DEFAULT now(),
  updated_at      timestamp DEFAULT now(),
  UNIQUE(campaign_id, organization_id)
);

-- ────────────────────────────────────────────────────────────
-- 8. org_invite_links table
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS org_invite_links (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token          varchar(64) UNIQUE NOT NULL,
  campaign_id    uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  category       varchar(50),
  creator_wallet varchar(42),
  expires_at     timestamp DEFAULT (now() + interval '14 days'),
  used_by        uuid REFERENCES organizations(id),
  used_at        timestamp,
  created_at     timestamp DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 9. document_analysis_cache table
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_analysis_cache (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  document_cid        varchar(255),       -- IPFS CID
  doc_type            varchar(50),
  extracted_entities  jsonb,
  analysis_version    integer,
  created_at          timestamp DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- Done
-- ────────────────────────────────────────────────────────────
-- Next steps:
-- 1. Run this SQL in Supabase SQL editor
-- 2. Go to Authentication > Triggers in Supabase dashboard and verify
--    the on_auth_user_created trigger was created
-- 3. Test: sign up via /signup → check public.users table for the new row
-- 4. Run: node scripts/admin_seed.js <your-email> to grant admin access

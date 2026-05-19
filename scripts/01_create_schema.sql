-- ============================================================
-- CrowdfundingEscrow Platform — Supabase PostgreSQL Schema
-- Run this in your Supabase SQL editor to set up the database.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Clean slate (drop old tables if re-running)
-- ────────────────────────────────────────────────────────────
drop table if exists admin_actions          cascade;
drop table if exists image_hashes           cascade;
drop table if exists verifier_endorsements  cascade;
drop table if exists ai_verifications       cascade;
drop table if exists donations              cascade;
drop table if exists withdrawal_requests    cascade;
drop table if exists milestones             cascade;
drop table if exists campaigns              cascade;
drop table if exists users                  cascade;

-- Drop old types that may still exist
drop type if exists user_type_enum          cascade;
drop type if exists campaign_status_enum    cascade;
drop type if exists milestone_status_enum   cascade;
drop type if exists request_status_enum     cascade;
drop type if exists ai_risk_enum            cascade;
drop type if exists ai_reco_enum            cascade;
drop type if exists admin_action_enum       cascade;
drop type if exists donation_status_enum    cascade;
drop type if exists category_enum           cascade;
drop type if exists target_type_enum        cascade;

-- ────────────────────────────────────────────────────────────
-- Custom types / enums
-- ────────────────────────────────────────────────────────────
create type user_type_enum       as enum ('donor', 'creator', 'verifier', 'admin');
create type campaign_status_enum as enum (
    'pending_ai',            -- AI scoring in progress
    'pending_verification',  -- Needs trusted verifier (score 40-70)
    'pending_review',        -- Needs admin review (score < 40)
    'active',                -- Live and accepting donations
    'funded',                -- Target reached, still accepting milestones
    'completed',             -- All milestones released
    'cancelled',             -- Cancelled — refunds available
    'rejected'               -- Rejected by admin
);
create type milestone_status_enum as enum ('pending', 'withdrawal_requested', 'released', 'rejected');
create type request_status_enum   as enum ('pending', 'approved', 'rejected');
create type ai_risk_enum          as enum ('low', 'medium', 'high');
create type ai_reco_enum          as enum ('approve', 'flag', 'reject');
create type admin_action_enum     as enum (
    'approve_campaign', 'reject_campaign',
    'approve_withdrawal', 'reject_withdrawal',
    'cancel_campaign', 'freeze_campaign'
);
create type donation_status_enum  as enum ('pending', 'confirmed', 'failed');
create type category_enum         as enum ('medical', 'education', 'disaster', 'community');
create type target_type_enum      as enum ('campaign', 'withdrawal_request');

-- ────────────────────────────────────────────────────────────
-- users
-- ────────────────────────────────────────────────────────────
create table users (
    id                 uuid primary key default gen_random_uuid(),
    wallet_address     varchar(42) unique not null,
    email              varchar,
    full_name          varchar,
    user_type          user_type_enum not null default 'donor',
    -- For trusted verifiers only
    verifier_org_name  varchar,
    verifier_category  category_enum,       -- which campaign type they can vouch for
    is_active          boolean not null default true,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- campaigns
-- ────────────────────────────────────────────────────────────
create table campaigns (
    id                   uuid primary key default gen_random_uuid(),
    contract_id          integer,                -- on-chain campaign ID (set after tx confirms)
    creator_wallet       varchar(42) not null,
    title                varchar(200) not null,
    description          text not null,
    category             category_enum not null,
    image_url            varchar,                -- Pinata IPFS URL for cover image
    target_amount_eth    numeric(20, 8) not null,
    current_amount_eth   numeric(20, 8) not null default 0,
    status               campaign_status_enum not null default 'pending_ai',
    deadline             timestamptz,
    ipfs_metadata_hash   varchar,                -- on-chain IPFS reference
    -- AI scoring results (cached; re-run on edit)
    ai_trust_score       integer,                -- 0–100
    ai_risk_level        ai_risk_enum,
    ai_flags             jsonb,                  -- string[]
    ai_explanation       text,
    -- Per-signal breakdown (each 0-25)
    ai_text_score        integer,
    ai_semantic_score    integer,
    ai_amount_score      integer,
    ai_image_score       integer,
    -- MiniLM embedding stored for duplicate detection
    embedding            jsonb,                  -- float[] — all-MiniLM-L6-v2 384-dim vector
    platform_approved    boolean not null default false,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now()
);

create index idx_campaigns_creator      on campaigns (creator_wallet);
create index idx_campaigns_status       on campaigns (status);
create index idx_campaigns_category     on campaigns (category);
create index idx_campaigns_trust_score  on campaigns (ai_trust_score);
create index idx_campaigns_created_at   on campaigns (created_at desc);

-- ────────────────────────────────────────────────────────────
-- milestones
-- ────────────────────────────────────────────────────────────
create table milestones (
    id                    uuid primary key default gen_random_uuid(),
    campaign_id           uuid not null references campaigns (id) on delete cascade,
    contract_milestone_id integer,              -- on-chain milestone index (if tracked)
    title                 varchar(200) not null,
    description           text,
    target_amount_eth     numeric(20, 8) not null,
    sequence_order        integer not null default 0,
    expected_proof_types  text,               -- e.g. "invoice, photo"
    status                milestone_status_enum not null default 'pending',
    created_at            timestamptz not null default now()
);

create index idx_milestones_campaign on milestones (campaign_id);

-- ────────────────────────────────────────────────────────────
-- withdrawal_requests
-- ────────────────────────────────────────────────────────────
create table withdrawal_requests (
    id                    uuid primary key default gen_random_uuid(),
    campaign_id           uuid not null references campaigns (id) on delete cascade,
    milestone_id          uuid references milestones (id),
    contract_request_id   integer,              -- on-chain withdrawal request index
    requested_amount_eth  numeric(20, 8) not null,
    proof_ipfs_hash       varchar not null,     -- IPFS CID of proof bundle
    proof_description     text,                 -- creator's explanation
    -- AI analysis results
    ai_consistency_score  integer,              -- 0–100
    ai_recommendation     ai_reco_enum,
    ai_admin_note         text,
    -- Review outcome
    status                request_status_enum not null default 'pending',
    rejection_reason      text,
    admin_tx_hash         varchar,              -- on-chain approval tx hash
    reviewed_at           timestamptz,
    created_at            timestamptz not null default now()
);

create index idx_withdrawals_campaign on withdrawal_requests (campaign_id);
create index idx_withdrawals_status   on withdrawal_requests (status);

-- ────────────────────────────────────────────────────────────
-- verifier_endorsements
-- ────────────────────────────────────────────────────────────
create table verifier_endorsements (
    id                       uuid primary key default gen_random_uuid(),
    campaign_id              uuid not null references campaigns (id) on delete cascade,
    verifier_wallet          varchar(42) not null,
    verifier_org_name        varchar not null,
    corroborating_doc_ipfs   varchar,            -- verifier's own uploaded proof
    endorsement_note         text,
    created_at               timestamptz not null default now(),
    unique (campaign_id, verifier_wallet)         -- one endorsement per verifier per campaign
);

create index idx_endorsements_campaign on verifier_endorsements (campaign_id);

-- ────────────────────────────────────────────────────────────
-- donations  (off-chain mirror of on-chain events)
-- ────────────────────────────────────────────────────────────
create table donations (
    id               uuid primary key default gen_random_uuid(),
    campaign_id      uuid not null references campaigns (id) on delete cascade,
    donor_wallet     varchar(42) not null,
    amount_eth       numeric(20, 8) not null,
    transaction_hash varchar unique not null,
    block_number     integer,
    status           donation_status_enum not null default 'pending',
    created_at       timestamptz not null default now()
);

create index idx_donations_campaign on donations (campaign_id);
create index idx_donations_donor    on donations (donor_wallet);
create index idx_donations_tx       on donations (transaction_hash);

-- ────────────────────────────────────────────────────────────
-- ai_verifications  (raw AI pipeline results)
-- ────────────────────────────────────────────────────────────
create table ai_verifications (
    id                  uuid primary key default gen_random_uuid(),
    campaign_id         uuid references campaigns (id) on delete cascade,
    -- For withdrawal proof analysis: link to the request instead
    withdrawal_id       uuid references withdrawal_requests (id) on delete cascade,
    verification_type   varchar not null,        -- 'campaign_analysis' | 'proof_analysis'
    -- Scores from custom ML pipeline
    text_score          integer,                 -- 0–25 from text analyzer
    semantic_score      integer,                 -- 0–25 from MiniLM similarity
    amount_score        integer,                 -- 0–25 from statistical check
    image_reuse_flag    boolean default false,
    final_score         integer,                 -- 0–100 combined
    risk_level          ai_risk_enum,
    flags               jsonb,                   -- string[] of specific issues
    explanation         text,                    -- LLM-generated admin summary
    raw_response        jsonb,                   -- full API response for debugging
    created_at          timestamptz not null default now()
);

create index idx_ai_verif_campaign    on ai_verifications (campaign_id);
create index idx_ai_verif_withdrawal  on ai_verifications (withdrawal_id);

-- ────────────────────────────────────────────────────────────
-- image_hashes  (perceptual hashes for duplicate detection)
-- ────────────────────────────────────────────────────────────
create table image_hashes (
    id           uuid primary key default gen_random_uuid(),
    campaign_id  uuid not null references campaigns (id) on delete cascade,
    phash        varchar(64) not null,            -- perceptual hash hex string
    image_url    varchar,
    created_at   timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- admin_actions  (immutable audit log)
-- ────────────────────────────────────────────────────────────
create table admin_actions (
    id           uuid primary key default gen_random_uuid(),
    admin_wallet varchar(42) not null,
    action_type  admin_action_enum not null,
    target_id    uuid not null,
    target_type  target_type_enum not null,
    reason       text,
    tx_hash      varchar,                        -- on-chain tx if applicable
    created_at   timestamptz not null default now()
);

create index idx_admin_actions_type   on admin_actions (action_type);
create index idx_admin_actions_target on admin_actions (target_id);

-- ────────────────────────────────────────────────────────────
-- Row-Level Security
-- ────────────────────────────────────────────────────────────
alter table users                 enable row level security;
alter table campaigns             enable row level security;
alter table milestones            enable row level security;
alter table withdrawal_requests   enable row level security;
alter table verifier_endorsements enable row level security;
alter table donations             enable row level security;
alter table ai_verifications      enable row level security;
alter table image_hashes          enable row level security;
alter table admin_actions         enable row level security;

-- Public read access for campaigns, milestones, donations (transparency)
create policy "public_read_campaigns"     on campaigns             for select using (true);
create policy "public_read_milestones"    on milestones            for select using (true);
create policy "public_read_donations"     on donations             for select using (true);
create policy "public_read_endorsements"  on verifier_endorsements for select using (true);
create policy "public_read_admin_actions" on admin_actions         for select using (true);
create policy "public_read_ai_verif"      on ai_verifications      for select using (true);
create policy "public_read_image_hashes"  on image_hashes          for select using (true);
create policy "public_read_withdrawals"   on withdrawal_requests   for select using (true);
create policy "public_read_users"         on users                 for select using (true);

-- Service-role key (used by Next.js API routes) bypasses RLS automatically.
-- All writes go through server-side API routes which validate the caller wallet.

-- Migration: add per-signal AI score columns to campaigns table
-- Run this in Supabase SQL editor if you already ran 01_create_schema.sql
-- Safe to run multiple times (uses IF NOT EXISTS pattern)

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'campaigns' and column_name = 'ai_text_score'
  ) then
    alter table campaigns
      add column ai_text_score     integer,
      add column ai_semantic_score integer,
      add column ai_amount_score   integer,
      add column ai_image_score    integer;
  end if;
end
$$;

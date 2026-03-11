-- Add injection FTD tracking columns to leads table
-- These are separate from the regular FTD (is_ftd) which comes from affiliate API submissions.
-- injection_ftd is set when a broker sends back an FTD update for an injected lead.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS injection_ftd BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS injection_ftd_date TIMESTAMPTZ;

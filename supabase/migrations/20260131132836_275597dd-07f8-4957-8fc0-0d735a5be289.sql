-- Add advertiser status and FTD tracking columns to injection_leads
ALTER TABLE public.injection_leads
ADD COLUMN IF NOT EXISTS sale_status text,
ADD COLUMN IF NOT EXISTS is_ftd boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS ftd_date timestamp with time zone;
-- Add priority column for explicit primary/fallback ordering
-- Priority 1 = Primary, Priority 2 = Fallback 1, Priority 3 = Fallback 2, etc.
ALTER TABLE public.advertiser_distribution_settings 
ADD COLUMN priority integer NOT NULL DEFAULT 999;

-- Add comment for clarity
COMMENT ON COLUMN public.advertiser_distribution_settings.priority IS 'Distribution priority: 1 = Primary, 2+ = Fallback order';
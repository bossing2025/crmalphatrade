-- Add baseline tracking for GEO caps when resuming
-- This stores the sent-per-country counts at the time of resume
-- so new caps are evaluated fresh (not counting previously sent leads)
ALTER TABLE public.injections
ADD COLUMN geo_caps_baseline JSONB DEFAULT NULL;

COMMENT ON COLUMN public.injections.geo_caps_baseline IS 'Stores sent-per-country counts at resume time. When evaluating caps, subtract baseline from current sent count.';

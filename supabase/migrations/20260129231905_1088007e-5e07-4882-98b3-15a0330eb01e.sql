-- Add weekly_schedule JSONB column for day-of-week scheduling
ALTER TABLE public.advertiser_distribution_settings 
ADD COLUMN weekly_schedule JSONB DEFAULT NULL;

-- Add a comment to document the expected structure
COMMENT ON COLUMN public.advertiser_distribution_settings.weekly_schedule IS 'JSONB object with per-day schedules. Structure: { "monday": { "is_active": true, "start_time": "09:00", "end_time": "18:00" }, ... }. If NULL, falls back to start_time/end_time columns.';
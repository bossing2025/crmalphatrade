-- Add working hours columns to affiliate_distribution_rules
ALTER TABLE affiliate_distribution_rules
ADD COLUMN start_time TEXT,
ADD COLUMN end_time TEXT,
ADD COLUMN weekly_schedule JSONB;

-- Add comment for documentation
COMMENT ON COLUMN affiliate_distribution_rules.start_time IS 'Simple daily start time (e.g., "09:00"). If set with end_time, rule only active during this window each day.';
COMMENT ON COLUMN affiliate_distribution_rules.end_time IS 'Simple daily end time (e.g., "18:00"). If set with start_time, rule only active during this window each day.';
COMMENT ON COLUMN affiliate_distribution_rules.weekly_schedule IS 'Full weekly schedule with per-day configuration. Overrides start_time/end_time if set.';
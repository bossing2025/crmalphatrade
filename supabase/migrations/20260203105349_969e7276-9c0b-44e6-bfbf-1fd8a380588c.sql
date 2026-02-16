-- Add timezone column to affiliate_distribution_rules
ALTER TABLE affiliate_distribution_rules
ADD COLUMN timezone TEXT DEFAULT 'UTC';

-- Add comment for documentation
COMMENT ON COLUMN affiliate_distribution_rules.timezone IS 'Timezone for working hours (e.g., "Europe/London", "America/New_York"). Defaults to UTC.';
-- Add priority_type column to affiliate_distribution_rules
-- 'primary' = leads go here first
-- 'fallback' = only receives leads if all primary brokers fail
ALTER TABLE affiliate_distribution_rules 
ADD COLUMN priority_type text NOT NULL DEFAULT 'primary' 
CHECK (priority_type IN ('primary', 'fallback'));
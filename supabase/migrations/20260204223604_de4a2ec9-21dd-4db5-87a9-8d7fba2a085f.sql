-- Add deal_type to advertiser_payouts table
ALTER TABLE public.advertiser_payouts
ADD COLUMN deal_type text NOT NULL DEFAULT 'cpa';

-- Add default_deal_type to advertisers table
ALTER TABLE public.advertisers
ADD COLUMN default_deal_type text NOT NULL DEFAULT 'cpa';

-- Add comment to explain deal types
COMMENT ON COLUMN public.advertiser_payouts.deal_type IS 'Deal type: cpa (Cost Per Acquisition/FTD), cpl (Cost Per Lead), crg (Cost Per Registration)';
COMMENT ON COLUMN public.advertisers.default_deal_type IS 'Default deal type for this advertiser when no country-specific payout exists';
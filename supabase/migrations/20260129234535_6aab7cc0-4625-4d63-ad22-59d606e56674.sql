-- Add autologin_url column to lead_distributions table
ALTER TABLE public.lead_distributions 
ADD COLUMN autologin_url TEXT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.lead_distributions.autologin_url IS 'Autologin URL returned by the advertiser for instant user login';
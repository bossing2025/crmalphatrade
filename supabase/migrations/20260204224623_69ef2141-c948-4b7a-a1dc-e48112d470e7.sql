-- Add CRG-specific fields to advertiser_payouts
ALTER TABLE public.advertiser_payouts
ADD COLUMN IF NOT EXISTS crg_base_price numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS crg_guarantee_percent numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS lead_count integer DEFAULT 0;

-- Add CRG-specific fields to advertisers for defaults
ALTER TABLE public.advertisers
ADD COLUMN IF NOT EXISTS default_crg_base_price numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS default_crg_guarantee_percent numeric DEFAULT 0;

-- Create affiliate payouts table for affiliate-side payout management
CREATE TABLE IF NOT EXISTS public.affiliate_payouts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  advertiser_id uuid REFERENCES public.advertisers(id) ON DELETE SET NULL,
  country_code text NOT NULL,
  deal_type text NOT NULL DEFAULT 'cpa',
  revenue numeric NOT NULL DEFAULT 0,
  payout numeric NOT NULL DEFAULT 0,
  crg_base_price numeric DEFAULT 0,
  crg_guarantee_percent numeric DEFAULT 0,
  lead_count integer DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(affiliate_id, advertiser_id, country_code)
);

-- Enable RLS on affiliate_payouts
ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;

-- RLS policies for affiliate_payouts
CREATE POLICY "Super admins and managers can view affiliate payouts" 
ON public.affiliate_payouts 
FOR SELECT 
USING (is_super_admin(auth.uid()) OR is_manager(auth.uid()));

CREATE POLICY "Super admins can insert affiliate payouts" 
ON public.affiliate_payouts 
FOR INSERT 
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update affiliate payouts" 
ON public.affiliate_payouts 
FOR UPDATE 
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete affiliate payouts" 
ON public.affiliate_payouts 
FOR DELETE 
USING (is_super_admin(auth.uid()));
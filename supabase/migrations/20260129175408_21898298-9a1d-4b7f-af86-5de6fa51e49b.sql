-- Create affiliate distribution rules table
CREATE TABLE public.affiliate_distribution_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,
  advertiser_id UUID NOT NULL REFERENCES public.advertisers(id) ON DELETE CASCADE,
  weight INTEGER NOT NULL DEFAULT 100,
  daily_cap INTEGER DEFAULT NULL,
  hourly_cap INTEGER DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure unique combination of affiliate + country + advertiser
  UNIQUE(affiliate_id, country_code, advertiser_id)
);

-- Create index for fast lookups
CREATE INDEX idx_affiliate_distribution_rules_lookup 
ON public.affiliate_distribution_rules(affiliate_id, country_code, is_active);

-- Enable RLS
ALTER TABLE public.affiliate_distribution_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage affiliate distribution rules"
ON public.affiliate_distribution_rules
FOR ALL
USING (is_super_admin(auth.uid()) OR is_manager(auth.uid()));

CREATE POLICY "Staff can view affiliate distribution rules"
ON public.affiliate_distribution_rules
FOR SELECT
USING (is_super_admin(auth.uid()) OR is_manager(auth.uid()) OR is_agent(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_affiliate_distribution_rules_updated_at
BEFORE UPDATE ON public.affiliate_distribution_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
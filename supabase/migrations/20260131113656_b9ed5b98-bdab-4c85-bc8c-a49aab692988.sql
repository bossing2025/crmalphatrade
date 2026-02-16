-- Create enum for injection pool status
CREATE TYPE public.injection_pool_status AS ENUM ('draft', 'running', 'paused', 'completed', 'cancelled');

-- Create enum for injection lead status
CREATE TYPE public.injection_lead_status AS ENUM ('pending', 'scheduled', 'sending', 'sent', 'failed', 'skipped');

-- Create injection_pools table
CREATE TABLE public.injection_pools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  advertiser_id UUID NOT NULL REFERENCES public.advertisers(id) ON DELETE CASCADE,
  status public.injection_pool_status NOT NULL DEFAULT 'draft',
  source_affiliate_ids UUID[] DEFAULT '{}',
  source_from_date TIMESTAMP WITH TIME ZONE,
  source_to_date TIMESTAMP WITH TIME ZONE,
  source_countries TEXT[] DEFAULT '{}',
  geo_caps JSONB DEFAULT '{}',
  min_delay_seconds INTEGER NOT NULL DEFAULT 30,
  max_delay_seconds INTEGER NOT NULL DEFAULT 180,
  noise_level TEXT NOT NULL DEFAULT 'medium' CHECK (noise_level IN ('low', 'medium', 'high')),
  working_start_time TIME,
  working_end_time TIME,
  working_days TEXT[] DEFAULT '{"monday", "tuesday", "wednesday", "thursday", "friday"}',
  total_leads INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  next_scheduled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Create injection_pool_leads table
CREATE TABLE public.injection_pool_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pool_id UUID NOT NULL REFERENCES public.injection_pools(id) ON DELETE CASCADE,
  firstname TEXT NOT NULL,
  lastname TEXT NOT NULL,
  email TEXT NOT NULL,
  mobile TEXT NOT NULL,
  country_code TEXT NOT NULL,
  country TEXT,
  ip_address TEXT,
  offer_name TEXT,
  custom1 TEXT,
  custom2 TEXT,
  custom3 TEXT,
  comment TEXT,
  status public.injection_lead_status NOT NULL DEFAULT 'pending',
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  autologin_url TEXT,
  external_lead_id TEXT,
  response TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_injection_pools_status ON public.injection_pools(status);
CREATE INDEX idx_injection_pools_advertiser ON public.injection_pools(advertiser_id);
CREATE INDEX idx_injection_pool_leads_pool_id ON public.injection_pool_leads(pool_id);
CREATE INDEX idx_injection_pool_leads_status ON public.injection_pool_leads(status);
CREATE INDEX idx_injection_pool_leads_scheduled ON public.injection_pool_leads(scheduled_at) WHERE status IN ('pending', 'scheduled');

-- Enable RLS
ALTER TABLE public.injection_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.injection_pool_leads ENABLE ROW LEVEL SECURITY;

-- RLS policies for injection_pools
CREATE POLICY "Staff can view injection pools"
  ON public.injection_pools
  FOR SELECT
  USING (is_super_admin(auth.uid()) OR is_manager(auth.uid()));

CREATE POLICY "Admins can manage injection pools"
  ON public.injection_pools
  FOR ALL
  USING (is_super_admin(auth.uid()) OR is_manager(auth.uid()));

-- RLS policies for injection_pool_leads
CREATE POLICY "Staff can view injection pool leads"
  ON public.injection_pool_leads
  FOR SELECT
  USING (is_super_admin(auth.uid()) OR is_manager(auth.uid()));

CREATE POLICY "Admins can manage injection pool leads"
  ON public.injection_pool_leads
  FOR ALL
  USING (is_super_admin(auth.uid()) OR is_manager(auth.uid()));

-- Add trigger for updated_at on injection_pools
CREATE TRIGGER update_injection_pools_updated_at
  BEFORE UPDATE ON public.injection_pools
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
-- Create lead_pools table (container for imported leads)
CREATE TABLE IF NOT EXISTS public.lead_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create lead_pool_leads table (raw lead storage, no processing status)
CREATE TABLE IF NOT EXISTS public.lead_pool_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID REFERENCES public.lead_pools(id) ON DELETE CASCADE NOT NULL,
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
  source_affiliate_id UUID,
  source_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create injections table (sending campaigns)
CREATE TABLE IF NOT EXISTS public.injections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  pool_id UUID REFERENCES public.lead_pools(id) NOT NULL,
  advertiser_id UUID REFERENCES public.advertisers(id) NOT NULL,
  status injection_pool_status DEFAULT 'draft' NOT NULL,
  -- Filters for selecting leads from pool
  filter_countries TEXT[] DEFAULT '{}',
  filter_affiliate_ids UUID[] DEFAULT '{}',
  filter_from_date TIMESTAMPTZ,
  filter_to_date TIMESTAMPTZ,
  -- Caps and timing settings
  geo_caps JSONB DEFAULT '{}',
  min_delay_seconds INTEGER DEFAULT 30 NOT NULL,
  max_delay_seconds INTEGER DEFAULT 180 NOT NULL,
  noise_level TEXT DEFAULT 'medium' NOT NULL,
  working_start_time TIME,
  working_end_time TIME,
  working_days TEXT[] DEFAULT '{monday,tuesday,wednesday,thursday,friday}',
  -- Stats
  total_leads INTEGER DEFAULT 0 NOT NULL,
  sent_count INTEGER DEFAULT 0 NOT NULL,
  failed_count INTEGER DEFAULT 0 NOT NULL,
  skipped_count INTEGER DEFAULT 0 NOT NULL,
  next_scheduled_at TIMESTAMPTZ,
  -- Metadata
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create injection_leads table (leads actively being processed)
CREATE TABLE IF NOT EXISTS public.injection_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  injection_id UUID REFERENCES public.injections(id) ON DELETE CASCADE NOT NULL,
  pool_lead_id UUID REFERENCES public.lead_pool_leads(id),
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
  status injection_lead_status DEFAULT 'pending' NOT NULL,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  autologin_url TEXT,
  external_lead_id TEXT,
  response TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS on all new tables
ALTER TABLE public.lead_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_pool_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.injections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.injection_leads ENABLE ROW LEVEL SECURITY;

-- RLS policies for lead_pools
CREATE POLICY "Staff can view lead pools" ON public.lead_pools
  FOR SELECT USING (is_super_admin(auth.uid()) OR is_manager(auth.uid()));

CREATE POLICY "Admins can manage lead pools" ON public.lead_pools
  FOR ALL USING (is_super_admin(auth.uid()) OR is_manager(auth.uid()));

-- RLS policies for lead_pool_leads
CREATE POLICY "Staff can view lead pool leads" ON public.lead_pool_leads
  FOR SELECT USING (is_super_admin(auth.uid()) OR is_manager(auth.uid()));

CREATE POLICY "Admins can manage lead pool leads" ON public.lead_pool_leads
  FOR ALL USING (is_super_admin(auth.uid()) OR is_manager(auth.uid()));

-- RLS policies for injections
CREATE POLICY "Staff can view injections" ON public.injections
  FOR SELECT USING (is_super_admin(auth.uid()) OR is_manager(auth.uid()));

CREATE POLICY "Admins can manage injections" ON public.injections
  FOR ALL USING (is_super_admin(auth.uid()) OR is_manager(auth.uid()));

-- RLS policies for injection_leads
CREATE POLICY "Staff can view injection leads" ON public.injection_leads
  FOR SELECT USING (is_super_admin(auth.uid()) OR is_manager(auth.uid()));

CREATE POLICY "Admins can manage injection leads" ON public.injection_leads
  FOR ALL USING (is_super_admin(auth.uid()) OR is_manager(auth.uid()));

-- Create indexes for better query performance
CREATE INDEX idx_lead_pool_leads_pool_id ON public.lead_pool_leads(pool_id);
CREATE INDEX idx_lead_pool_leads_country_code ON public.lead_pool_leads(country_code);
CREATE INDEX idx_lead_pool_leads_source_affiliate ON public.lead_pool_leads(source_affiliate_id);
CREATE INDEX idx_injections_pool_id ON public.injections(pool_id);
CREATE INDEX idx_injections_advertiser_id ON public.injections(advertiser_id);
CREATE INDEX idx_injections_status ON public.injections(status);
CREATE INDEX idx_injection_leads_injection_id ON public.injection_leads(injection_id);
CREATE INDEX idx_injection_leads_status ON public.injection_leads(status);

-- Create updated_at triggers
CREATE TRIGGER update_lead_pools_updated_at
  BEFORE UPDATE ON public.lead_pools
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_injections_updated_at
  BEFORE UPDATE ON public.injections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('super_admin', 'manager', 'agent', 'affiliate');

-- Create enum for lead status
CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'qualified', 'converted', 'lost');

-- Create enum for distribution status
CREATE TYPE public.distribution_status AS ENUM ('pending', 'sent', 'failed');

-- Create enum for advertiser type
CREATE TYPE public.advertiser_type AS ENUM ('internal', 'trackbox', 'edgecast', 'smart_trade', 'doctormailer', 'dragon_media', 'adscrm', 'revdale', 'custom');

-- =====================================================
-- PROFILES TABLE (linked to auth.users)
-- =====================================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- USER ROLES TABLE (separate from profiles for security)
-- =====================================================
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, role)
);

-- =====================================================
-- AFFILIATES TABLE
-- =====================================================
CREATE TABLE public.affiliates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    api_key TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- ADVERTISERS TABLE
-- =====================================================
CREATE TABLE public.advertisers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    advertiser_type advertiser_type NOT NULL DEFAULT 'custom',
    url TEXT,
    api_key TEXT,
    config JSONB DEFAULT '{}',
    daily_cap INTEGER DEFAULT 100,
    hourly_cap INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- LEADS TABLE
-- =====================================================
CREATE TABLE public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id TEXT UNIQUE DEFAULT gen_random_uuid()::text,
    firstname TEXT NOT NULL,
    lastname TEXT NOT NULL,
    email TEXT NOT NULL,
    mobile TEXT NOT NULL,
    country_code TEXT NOT NULL,
    country TEXT,
    ip_address TEXT,
    status lead_status NOT NULL DEFAULT 'new',
    affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_ftd BOOLEAN NOT NULL DEFAULT false,
    ftd_date TIMESTAMPTZ,
    distributed_at TIMESTAMPTZ,
    custom1 TEXT,
    custom2 TEXT,
    custom3 TEXT,
    offer_name TEXT,
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- LEAD DISTRIBUTIONS TABLE
-- =====================================================
CREATE TABLE public.lead_distributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    advertiser_id UUID NOT NULL REFERENCES public.advertisers(id) ON DELETE CASCADE,
    affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE SET NULL,
    status distribution_status NOT NULL DEFAULT 'pending',
    response TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- ADVERTISER DISTRIBUTION SETTINGS TABLE
-- =====================================================
CREATE TABLE public.advertiser_distribution_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_id UUID NOT NULL REFERENCES public.advertisers(id) ON DELETE CASCADE,
    affiliates UUID[] DEFAULT '{}',
    countries TEXT[] DEFAULT '{}',
    default_daily_cap INTEGER DEFAULT 100,
    default_hourly_cap INTEGER,
    start_time TIME,
    end_time TIME,
    base_weight INTEGER DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- ADVERTISER CONVERSIONS TABLE
-- =====================================================
CREATE TABLE public.advertiser_conversions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_id UUID NOT NULL REFERENCES public.advertisers(id) ON DELETE CASCADE UNIQUE,
    leads INTEGER NOT NULL DEFAULT 0,
    conversion INTEGER NOT NULL DEFAULT 0,
    failed_leads INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- REJECTED LEADS TABLE
-- =====================================================
CREATE TABLE public.rejected_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_id UUID NOT NULL REFERENCES public.advertisers(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(advertiser_id, lead_id)
);

-- =====================================================
-- HELPER FUNCTIONS (Security Definer to avoid RLS recursion)
-- =====================================================

-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role = _role
    );
$$;

-- Check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.has_role(_user_id, 'super_admin');
$$;

-- Check if user is manager
CREATE OR REPLACE FUNCTION public.is_manager(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.has_role(_user_id, 'manager');
$$;

-- Check if user is agent
CREATE OR REPLACE FUNCTION public.is_agent(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.has_role(_user_id, 'agent');
$$;

-- Get affiliate by API key
CREATE OR REPLACE FUNCTION public.get_affiliate_by_api_key(_api_key TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id FROM public.affiliates
    WHERE api_key = _api_key AND is_active = true
    LIMIT 1;
$$;

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advertisers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advertiser_distribution_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advertiser_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rejected_leads ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES: PROFILES
-- =====================================================
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id OR public.is_super_admin(auth.uid()) OR public.is_manager(auth.uid()));

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Profiles created on signup"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- =====================================================
-- RLS POLICIES: USER_ROLES
-- =====================================================
CREATE POLICY "Super admins can manage roles"
ON public.user_roles FOR ALL
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- =====================================================
-- RLS POLICIES: AFFILIATES
-- =====================================================
CREATE POLICY "Admins and managers can view affiliates"
ON public.affiliates FOR SELECT
USING (public.is_super_admin(auth.uid()) OR public.is_manager(auth.uid()));

CREATE POLICY "Only super admins can manage affiliates"
ON public.affiliates FOR ALL
USING (public.is_super_admin(auth.uid()));

-- =====================================================
-- RLS POLICIES: ADVERTISERS
-- =====================================================
CREATE POLICY "Staff can view advertisers"
ON public.advertisers FOR SELECT
USING (public.is_super_admin(auth.uid()) OR public.is_manager(auth.uid()) OR public.is_agent(auth.uid()));

CREATE POLICY "Admins and managers can manage advertisers"
ON public.advertisers FOR INSERT
WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_manager(auth.uid()));

CREATE POLICY "Admins and managers can update advertisers"
ON public.advertisers FOR UPDATE
USING (public.is_super_admin(auth.uid()) OR public.is_manager(auth.uid()));

CREATE POLICY "Only super admins can delete advertisers"
ON public.advertisers FOR DELETE
USING (public.is_super_admin(auth.uid()));

-- =====================================================
-- RLS POLICIES: LEADS
-- =====================================================
CREATE POLICY "Staff can view leads"
ON public.leads FOR SELECT
USING (
    public.is_super_admin(auth.uid()) 
    OR public.is_manager(auth.uid()) 
    OR (public.is_agent(auth.uid()) AND assigned_to = auth.uid())
);

CREATE POLICY "Staff can insert leads"
ON public.leads FOR INSERT
WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_manager(auth.uid()));

CREATE POLICY "Staff can update leads"
ON public.leads FOR UPDATE
USING (
    public.is_super_admin(auth.uid()) 
    OR public.is_manager(auth.uid()) 
    OR (public.is_agent(auth.uid()) AND assigned_to = auth.uid())
);

CREATE POLICY "Only super admins can delete leads"
ON public.leads FOR DELETE
USING (public.is_super_admin(auth.uid()));

-- =====================================================
-- RLS POLICIES: LEAD_DISTRIBUTIONS
-- =====================================================
CREATE POLICY "Staff can view distributions"
ON public.lead_distributions FOR SELECT
USING (public.is_super_admin(auth.uid()) OR public.is_manager(auth.uid()) OR public.is_agent(auth.uid()));

CREATE POLICY "Admins and managers can manage distributions"
ON public.lead_distributions FOR ALL
USING (public.is_super_admin(auth.uid()) OR public.is_manager(auth.uid()));

-- =====================================================
-- RLS POLICIES: ADVERTISER_DISTRIBUTION_SETTINGS
-- =====================================================
CREATE POLICY "Staff can view settings"
ON public.advertiser_distribution_settings FOR SELECT
USING (public.is_super_admin(auth.uid()) OR public.is_manager(auth.uid()));

CREATE POLICY "Admins can manage settings"
ON public.advertiser_distribution_settings FOR ALL
USING (public.is_super_admin(auth.uid()) OR public.is_manager(auth.uid()));

-- =====================================================
-- RLS POLICIES: ADVERTISER_CONVERSIONS
-- =====================================================
CREATE POLICY "Staff can view conversions"
ON public.advertiser_conversions FOR SELECT
USING (public.is_super_admin(auth.uid()) OR public.is_manager(auth.uid()) OR public.is_agent(auth.uid()));

CREATE POLICY "Admins can manage conversions"
ON public.advertiser_conversions FOR ALL
USING (public.is_super_admin(auth.uid()) OR public.is_manager(auth.uid()));

-- =====================================================
-- RLS POLICIES: REJECTED_LEADS
-- =====================================================
CREATE POLICY "Staff can view rejected leads"
ON public.rejected_leads FOR SELECT
USING (public.is_super_admin(auth.uid()) OR public.is_manager(auth.uid()));

CREATE POLICY "Admins can manage rejected leads"
ON public.rejected_leads FOR ALL
USING (public.is_super_admin(auth.uid()) OR public.is_manager(auth.uid()));

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leads_updated_at
    BEFORE UPDATE ON public.leads
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_affiliates_updated_at
    BEFORE UPDATE ON public.affiliates
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_advertisers_updated_at
    BEFORE UPDATE ON public.advertisers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lead_distributions_updated_at
    BEFORE UPDATE ON public.lead_distributions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_advertiser_distribution_settings_updated_at
    BEFORE UPDATE ON public.advertiser_distribution_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_advertiser_conversions_updated_at
    BEFORE UPDATE ON public.advertiser_conversions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_leads_affiliate_id ON public.leads(affiliate_id);
CREATE INDEX idx_leads_assigned_to ON public.leads(assigned_to);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_created_at ON public.leads(created_at);
CREATE INDEX idx_leads_email ON public.leads(email);
CREATE INDEX idx_lead_distributions_lead_id ON public.lead_distributions(lead_id);
CREATE INDEX idx_lead_distributions_advertiser_id ON public.lead_distributions(advertiser_id);
CREATE INDEX idx_lead_distributions_status ON public.lead_distributions(status);
CREATE INDEX idx_affiliates_api_key ON public.affiliates(api_key);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
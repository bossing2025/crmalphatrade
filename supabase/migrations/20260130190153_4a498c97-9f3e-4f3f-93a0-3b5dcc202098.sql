-- Add 'custom' to advertiser_type enum
ALTER TYPE advertiser_type ADD VALUE 'custom';

-- Create table to store AI-generated integration configs
CREATE TABLE public.advertiser_integration_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
  
  -- API Configuration
  endpoint_url TEXT NOT NULL,
  http_method TEXT NOT NULL DEFAULT 'POST',
  content_type TEXT NOT NULL DEFAULT 'application/json',
  auth_type TEXT NOT NULL DEFAULT 'api_key',
  auth_header_name TEXT DEFAULT 'Api-Key',
  
  -- Field Mappings (your field -> their field)
  field_mappings JSONB NOT NULL DEFAULT '{}',
  
  -- Request Template (optional for complex cases)
  request_template JSONB,
  
  -- Response Parsing
  success_indicators JSONB NOT NULL DEFAULT '[]',
  error_indicators JSONB NOT NULL DEFAULT '[]',
  lead_id_path TEXT,
  autologin_url_path TEXT,
  
  -- Metadata
  original_docs TEXT,
  ai_analysis JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create unique constraint on advertiser_id (one config per advertiser)
CREATE UNIQUE INDEX idx_integration_configs_advertiser ON public.advertiser_integration_configs(advertiser_id);

-- Enable RLS
ALTER TABLE public.advertiser_integration_configs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage integration configs"
ON public.advertiser_integration_configs
FOR ALL
USING (is_super_admin(auth.uid()) OR is_manager(auth.uid()));

CREATE POLICY "Staff can view integration configs"
ON public.advertiser_integration_configs
FOR SELECT
USING (is_super_admin(auth.uid()) OR is_manager(auth.uid()) OR is_agent(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_integration_configs_updated_at
BEFORE UPDATE ON public.advertiser_integration_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
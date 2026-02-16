CREATE TABLE IF NOT EXISTS global_sent_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  advertiser_id UUID NOT NULL REFERENCES advertisers(id),
  injection_id UUID REFERENCES injections(id),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  country_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email, advertiser_id)
);

CREATE INDEX IF NOT EXISTS idx_global_sent_email ON global_sent_leads(email);
CREATE INDEX IF NOT EXISTS idx_global_sent_at ON global_sent_leads(sent_at);
CREATE INDEX IF NOT EXISTS idx_global_sent_advertiser ON global_sent_leads(advertiser_id);

ALTER TABLE global_sent_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage" ON global_sent_leads FOR ALL 
  USING (auth.role() = 'service_role'::text) WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY "Staff can view" ON global_sent_leads FOR SELECT 
  USING (is_super_admin(auth.uid()) OR is_manager(auth.uid()));
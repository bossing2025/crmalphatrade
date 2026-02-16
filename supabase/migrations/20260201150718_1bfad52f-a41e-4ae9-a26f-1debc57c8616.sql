-- Add traffic simulation fields to injection_leads table
ALTER TABLE injection_leads ADD COLUMN IF NOT EXISTS device_type TEXT;
ALTER TABLE injection_leads ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE injection_leads ADD COLUMN IF NOT EXISTS browser_language TEXT;
ALTER TABLE injection_leads ADD COLUMN IF NOT EXISTS timezone TEXT;
ALTER TABLE injection_leads ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE injection_leads ADD COLUMN IF NOT EXISTS isp_name TEXT;

-- Add traffic simulation state to injections table for stateful tracking
ALTER TABLE injections ADD COLUMN IF NOT EXISTS traffic_simulation_state JSONB DEFAULT '{}'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN injection_leads.device_type IS 'Device type: mobile or desktop';
COMMENT ON COLUMN injection_leads.user_agent IS 'Generated User-Agent string for the simulated browser';
COMMENT ON COLUMN injection_leads.browser_language IS 'Accept-Language header value matching country';
COMMENT ON COLUMN injection_leads.timezone IS 'Timezone string matching country (e.g., Europe/London)';
COMMENT ON COLUMN injection_leads.city IS 'Simulated city for IP clustering';
COMMENT ON COLUMN injection_leads.isp_name IS 'Simulated ISP name for rotation tracking';
COMMENT ON COLUMN injections.traffic_simulation_state IS 'JSON state for traffic simulation: lastDeviceTypes, lastUserAgents, currentCity, cityLeadsRemaining, currentIsp, ispLeadsRemaining, usedIps';
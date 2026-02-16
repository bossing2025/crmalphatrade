-- Update ELNOPY CRM type with correct API documentation
UPDATE public.crm_types
SET
  default_url = 'https://tracking.mpowertraffic2.com/api/v3/integration',
  request_format = 'form-urlencoded',
  auth_type = 'none',
  auth_header_name = NULL,
  field_mappings = '{
    "firstname": "fname",
    "lastname": "lname",
    "email": "email",
    "mobile": "fullphone",
    "country_code": "country",
    "ip_address": "ip",
    "offer_name": "funnel"
  }'::jsonb,
  extra_body_fields = '{
    "link_id": "${config.link_id}",
    "source": "${config.source}"
  }'::jsonb,
  required_fields = '[
    {"key": "api_token", "label": "API Token", "required": true, "description": "Your ELNOPY API authentication token"},
    {"key": "link_id", "label": "Link ID", "required": true, "description": "Your assigned Link ID (e.g. 198)"},
    {"key": "source", "label": "Source", "required": false, "description": "Source name for tracking (optional)"}
  ]'::jsonb,
  field_labels = '{
    "api_token": "API Token",
    "link_id": "Link ID",
    "source": "Source"
  }'::jsonb,
  field_descriptions = '{
    "api_token": "Your ELNOPY API authentication token from personal account",
    "link_id": "Your assigned Link ID number",
    "source": "Source name for tracking (optional)"
  }'::jsonb,
  success_check = '{"type": "json_field", "field": "success", "operator": "equals", "value": true}'::jsonb,
  error_check = '{"type": "json_field", "field": "success", "operator": "equals", "value": false}'::jsonb,
  lead_id_path = 'id',
  autologin_url_path = 'autologin',
  use_forwarder = true,
  updated_at = now()
WHERE code = 'elnopy';
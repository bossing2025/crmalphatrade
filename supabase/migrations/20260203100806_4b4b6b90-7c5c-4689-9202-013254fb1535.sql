-- Add ELNOPY to advertiser_type enum
ALTER TYPE advertiser_type ADD VALUE IF NOT EXISTS 'elnopy';

-- Create the ELNOPY CRM type
INSERT INTO public.crm_types (
  code,
  name,
  description,
  default_url,
  request_format,
  auth_type,
  auth_header_name,
  field_mappings,
  required_fields,
  field_labels,
  field_descriptions,
  success_check,
  error_check,
  lead_id_path,
  autologin_url_path,
  extra_body_fields,
  extra_headers,
  use_forwarder,
  is_active
) VALUES (
  'elnopy',
  'ELNOPY',
  'ELNOPY tracking platform - Mpower Traffic integration',
  'https://tracking.mpowertraffic2.com/api/v1/lead',
  'json',
  'header',
  'Authorization',
  '{
    "firstname": "first_name",
    "lastname": "last_name",
    "email": "email",
    "mobile": "phone",
    "country_code": "country",
    "ip_address": "ip",
    "offer_name": "offer"
  }'::jsonb,
  '[
    {"key": "api_token", "label": "API Token", "required": true, "description": "Your ELNOPY API authentication token"},
    {"key": "link_id", "label": "Link ID", "required": true, "description": "Your assigned Link ID (e.g. 198)"}
  ]'::jsonb,
  '{
    "api_token": "API Token",
    "link_id": "Link ID"
  }'::jsonb,
  '{
    "api_token": "Your ELNOPY API authentication token from personal account",
    "link_id": "Your assigned Link ID number"
  }'::jsonb,
  '{"type": "json_field", "field": "success", "operator": "equals", "value": true}'::jsonb,
  '{"type": "json_field", "field": "success", "operator": "equals", "value": false}'::jsonb,
  'data.lead_id',
  'data.autologin_url',
  '{}'::jsonb,
  '{}'::jsonb,
  true,
  true
);
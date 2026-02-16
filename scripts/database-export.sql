-- ============================================
-- MEGATRON CRM - Complete Database Export
-- Generated: 2026-01-30
-- ============================================
-- Run this script on your self-hosted Supabase AFTER running migrations
-- Order matters: parent tables first, then child tables

-- ============================================
-- 1. ADVERTISERS
-- ============================================
INSERT INTO advertisers (id, name, advertiser_type, api_key, url, config, daily_cap, hourly_cap, is_active, status_endpoint, created_at, updated_at) VALUES
('1ae4e4c7-e5e5-49d8-b781-0a59145524ef', 'Test Advertiser', 'getlinked', 'test-api-key-123', 'https://api.example.com/leads', '{}', 100, NULL, false, NULL, '2026-01-29 11:41:55.233087+00', '2026-01-29 18:53:50.201698+00'),
('1865cb57-6886-408f-ab31-4f2629cdfa7e', 'crmelite', 'timelocal', 'e183d2874ed45157fd394699411aeb987ee207e8fb80de61216c59f08b60a186', 'https://crm.elitetradingacademy.pro/api/leads', '{}', 100, NULL, true, NULL, '2026-01-29 13:06:55.722095+00', '2026-01-29 20:59:59.74528+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. AFFILIATES
-- ============================================
INSERT INTO affiliates (id, name, api_key, allowed_countries, callback_url, is_active, user_id, created_at, updated_at) VALUES
('54f457d1-5dc2-4052-80fa-1c80121da167', 'Test Affiliate', '6c93f37f-b259-41fc-8018-720cb2eb955d', ARRAY['CA'], NULL, true, NULL, '2026-01-29 11:41:54.035176+00', '2026-01-29 18:25:39.133471+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 3. PROFILES (for user data)
-- ============================================
-- Note: User auth records must be created separately in auth.users
-- This only inserts the profile data
INSERT INTO profiles (id, email, full_name, username, avatar_url, created_at, updated_at) VALUES
('40fbdec4-99fa-45cb-bace-8274a47fb934', '0360804@gmail.com', 'kiko kiko', '0360804', NULL, '2026-01-29 11:00:57.63572+00', '2026-01-29 21:50:41.396604+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 4. USER ROLES
-- ============================================
INSERT INTO user_roles (id, user_id, role, created_at) VALUES
('bba8cf19-98c7-495e-aafc-edbfd5b89f7c', '40fbdec4-99fa-45cb-bace-8274a47fb934', 'super_admin', '2026-01-29 21:50:41.618563+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 5. ADVERTISER DISTRIBUTION SETTINGS
-- ============================================
INSERT INTO advertiser_distribution_settings (id, advertiser_id, countries, affiliates, base_weight, priority, start_time, end_time, default_daily_cap, default_hourly_cap, is_active, weekly_schedule, created_at, updated_at) VALUES
('5721f415-1ae7-4c36-bc5e-7dd8905ae201', '1865cb57-6886-408f-ab31-4f2629cdfa7e', ARRAY['CA'], NULL, 100, 1, '00:00:00', '23:59:00', 100, NULL, true, '{"friday":{"end_time":"18:00","is_active":true,"start_time":"09:00"},"monday":{"end_time":"18:00","is_active":true,"start_time":"09:00"},"saturday":{"is_active":false},"sunday":{"is_active":false},"thursday":{"end_time":"18:00","is_active":true,"start_time":"09:00"},"tuesday":{"end_time":"18:00","is_active":true,"start_time":"09:00"},"wednesday":{"end_time":"18:00","is_active":true,"start_time":"09:00"}}', '2026-01-29 14:48:44.337948+00', '2026-01-29 23:26:47.21497+00'),
('9f409dae-c5af-45c8-86ec-90e6b2e9c9be', '1ae4e4c7-e5e5-49d8-b781-0a59145524ef', NULL, NULL, 100, 1, '00:00:00', '23:59:00', 100, NULL, false, '{"friday":{"end_time":"18:00","is_active":true,"start_time":"09:00"},"monday":{"end_time":"18:00","is_active":true,"start_time":"09:00"},"saturday":{"is_active":false},"sunday":{"is_active":false},"thursday":{"end_time":"18:00","is_active":true,"start_time":"09:00"},"tuesday":{"end_time":"18:00","is_active":true,"start_time":"09:00"},"wednesday":{"end_time":"18:00","is_active":true,"start_time":"09:00"}}', '2026-01-29 23:27:07.597011+00', '2026-01-29 23:27:07.597011+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 6. AFFILIATE DISTRIBUTION RULES
-- ============================================
INSERT INTO affiliate_distribution_rules (id, affiliate_id, advertiser_id, country_code, weight, priority_type, daily_cap, hourly_cap, is_active, created_at, updated_at) VALUES
('47773c40-de7c-487d-90aa-a67ac282f671', '54f457d1-5dc2-4052-80fa-1c80121da167', '1865cb57-6886-408f-ab31-4f2629cdfa7e', 'CA', 100, 'primary', 10, NULL, true, '2026-01-29 18:04:32.68034+00', '2026-01-29 18:04:32.68034+00'),
('568ff83b-157c-4e27-9e2f-748c8447c150', '54f457d1-5dc2-4052-80fa-1c80121da167', '1ae4e4c7-e5e5-49d8-b781-0a59145524ef', 'CA', 100, 'primary', 10, NULL, true, '2026-01-29 18:07:11.340179+00', '2026-01-29 18:07:11.340179+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 7. ADVERTISER CONVERSIONS
-- ============================================
INSERT INTO advertiser_conversions (id, advertiser_id, leads, conversion, failed_leads, created_at, updated_at) VALUES
('86ea1982-d514-4760-b9f8-b89f958a0a15', '1865cb57-6886-408f-ab31-4f2629cdfa7e', 4, 0, 22, '2026-01-29 13:09:37.884213+00', '2026-01-29 20:17:12.63537+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 8. ADVERTISER EMAIL REJECTIONS
-- ============================================
INSERT INTO advertiser_email_rejections (id, advertiser_id, email, rejection_reason, created_at) VALUES
('1d9ea13c-8f67-4af8-8144-138fbd3eeece', '1865cb57-6886-408f-ab31-4f2629cdfa7e', 'michael.smith.1769731340960@icloud.com', '{"error":"Invalid API token."}', '2026-01-30 00:03:32.411562+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 9. LEADS
-- ============================================
INSERT INTO leads (id, affiliate_id, firstname, lastname, email, mobile, country_code, country, ip_address, offer_name, custom1, custom2, custom3, status, is_ftd, ftd_date, ftd_released, ftd_released_at, ftd_released_by, distributed_at, assigned_to, comment, request_id, created_at, updated_at) VALUES
('0a245bb3-4348-4bb0-921d-de6dd6dcaaae', '54f457d1-5dc2-4052-80fa-1c80121da167', 'Test', 'User', 'testca@example.com', '14165551234', 'CA', 'Canada', '54.86.50.139', 'Winter Promo 2025', 'tracking123', NULL, NULL, 'converted', true, '2026-01-29 15:38:42.279+00', false, NULL, NULL, '2026-01-29 14:52:10.163+00', NULL, NULL, '3c57a848-e571-42e5-b741-8eab25821b40', '2026-01-29 14:51:52.974209+00', '2026-01-29 15:38:43.646152+00'),
('9783cddc-ea4a-4a36-b207-52360b6634fc', '54f457d1-5dc2-4052-80fa-1c80121da167', 'Test', 'User', 'testcac@example.com', '14165441234', 'CA', 'Canada', '54.86.50.139', 'Winter Promo 2025', 'tracking123', NULL, NULL, 'new', true, '2026-01-29 15:54:54.797+00', true, '2026-01-29 15:59:59.864+00', NULL, '2026-01-29 15:11:05.583+00', NULL, NULL, 'fa4b6d82-b789-4c29-b069-a3c6a8d0fa9d', '2026-01-29 15:10:59.766214+00', '2026-01-29 16:00:01.299258+00'),
('2e8ccb9c-983c-4e64-9494-ef3a2f11335e', '54f457d1-5dc2-4052-80fa-1c80121da167', 'Test', 'User', 'testca1c@example.com', '14165441234', 'CA', 'Canada', '54.86.50.139', 'Winter Promo 2025', 'tracking123', NULL, NULL, 'rejected', false, NULL, false, NULL, NULL, NULL, NULL, NULL, '1bb52006-053f-4c86-8a75-2e18f00e60ea', '2026-01-29 15:13:01.685742+00', '2026-01-29 15:13:04.531317+00'),
('bf907947-5c64-4626-b707-1a0df1d8c00e', '54f457d1-5dc2-4052-80fa-1c80121da167', 'Test', 'User', 'testcaccc@example.com', '14165441234', 'CA', 'Canada', '54.86.50.139', 'Winter Promo 2025', 'tracking123', NULL, NULL, 'rejected', false, NULL, false, NULL, NULL, NULL, NULL, NULL, '302df82c-a5c5-4f05-b7a6-821a3a3fd3d5', '2026-01-29 15:14:36.333602+00', '2026-01-29 15:14:38.972833+00'),
('4514b1f6-69a5-4cfd-8bbe-ced26d81dd88', '54f457d1-5dc2-4052-80fa-1c80121da167', 'Test', 'User', 'testca2ccc@example.com', '14165441234', 'CA', 'Canada', '54.86.50.139', 'Winter Promo 2025', 'tracking123', NULL, NULL, 'rejected', false, NULL, false, NULL, NULL, NULL, NULL, NULL, '347e1cda-030a-4290-8647-3f81d965c687', '2026-01-29 15:14:49.276488+00', '2026-01-29 15:15:20.178724+00'),
('c6abf20f-57e0-49a8-af0f-9ec8ad076154', '54f457d1-5dc2-4052-80fa-1c80121da167', 'Test', 'User', 'testca2c2cc@example.com', '14165441234', 'CA', 'Canada', '54.86.50.139', 'Winter Promo 2025', 'tracking123', NULL, NULL, 'rejected', false, NULL, false, NULL, NULL, NULL, NULL, NULL, '49082198-b99e-47fe-8f7f-613437fd5952', '2026-01-29 20:06:41.31846+00', '2026-01-29 20:06:44.38741+00'),
('acc91f39-0955-4f3d-a5d6-91db85f82a3e', '54f457d1-5dc2-4052-80fa-1c80121da167', 'Test', 'User', 'testca2cd2cc@example.com', '14165441234', 'CA', 'Canada', '54.86.50.139', 'Winter Promo 2025', 'tracking123', NULL, NULL, 'rejected', false, NULL, false, NULL, NULL, NULL, NULL, NULL, '59bda1a4-5d9a-444c-b980-6fa3a28f539a', '2026-01-29 20:08:05.821821+00', '2026-01-29 20:08:08.501051+00'),
('ff395171-dc78-4334-ac0a-348eba8d020d', '54f457d1-5dc2-4052-80fa-1c80121da167', 'TestAPI', 'Check', 'testapicheck456@example.com', '14165551234', 'CA', NULL, '34.90.243.85', NULL, NULL, NULL, NULL, 'rejected', false, NULL, false, NULL, NULL, NULL, NULL, NULL, '71ce4217-e4b8-4597-b324-b50f7ba6fa1b', '2026-01-29 20:10:48.825811+00', '2026-01-29 20:10:51.670595+00'),
('90054fdc-df7c-4a4b-97fa-af11822ae6e0', '54f457d1-5dc2-4052-80fa-1c80121da167', 'TestAPI', 'Check', 'testapicheck789@example.com', '14165551234', 'CA', NULL, '34.90.243.85', NULL, NULL, NULL, NULL, 'contacted', false, NULL, false, NULL, NULL, '2026-01-29 20:17:12.036+00', NULL, NULL, NULL, '2026-01-29 20:17:01.234+00', '2026-01-29 20:17:12.125+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 10. LEAD DISTRIBUTIONS
-- ============================================
INSERT INTO lead_distributions (id, lead_id, advertiser_id, affiliate_id, status, response, external_lead_id, autologin_url, sent_at, last_polled_at, created_at, updated_at) VALUES
('27fae859-4ae5-49f8-b221-f27fa8823e02', '0a245bb3-4348-4bb0-921d-de6dd6dcaaae', '1865cb57-6886-408f-ab31-4f2629cdfa7e', '54f457d1-5dc2-4052-80fa-1c80121da167', 'sent', '{"success":true,"message":"Lead saved and distributed successfully","count":2,"data":{"leadRequestID":"4766736c-875d-4695-b1de-81e82134f90b","lead_id":22116}}', '22116', NULL, '2026-01-29 14:52:09.985+00', NULL, '2026-01-29 14:52:10.084792+00', '2026-01-29 14:52:10.084792+00'),
('1957d3ff-ad47-42a6-82c2-322b5e915a49', '9783cddc-ea4a-4a36-b207-52360b6634fc', '1865cb57-6886-408f-ab31-4f2629cdfa7e', '54f457d1-5dc2-4052-80fa-1c80121da167', 'sent', '{"success":true,"message":"Lead saved and distributed successfully","count":2,"data":{"leadRequestID":"ae226304-7d96-4cfc-8966-d4a131af59c4","lead_id":22117}}', '22117', NULL, '2026-01-29 15:11:05.386+00', NULL, '2026-01-29 15:11:05.477622+00', '2026-01-29 15:11:05.477622+00'),
('8d3fa552-0240-4e9b-8f5b-0d8cacc8e177', '90054fdc-df7c-4a4b-97fa-af11822ae6e0', '1865cb57-6886-408f-ab31-4f2629cdfa7e', '54f457d1-5dc2-4052-80fa-1c80121da167', 'sent', '{"success":true,"message":"Lead saved and distributed successfully","count":2,"data":{"leadRequestID":"4ae78c8c-a806-4e31-b068-2553321584cd","lead_id":22118}}', '22118', NULL, '2026-01-29 20:17:12.036+00', NULL, '2026-01-29 20:17:12.125336+00', '2026-01-29 20:17:12.125336+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 11. REJECTED LEADS
-- ============================================
INSERT INTO rejected_leads (id, lead_id, advertiser_id, reason, created_at) VALUES
('bbe45ef4-2c8d-465f-bdb8-099fe45b94bf', '0a245bb3-4348-4bb0-921d-de6dd6dcaaae', '1ae4e4c7-e5e5-49d8-b781-0a59145524ef', 'error sending request for url (https://api.example.com/leads): client error (Connect): dns error: failed to lookup address information: No address associated with hostname', '2026-01-29 14:51:54.374827+00'),
('754a2f03-b400-40d2-8da8-19bd69543287', '9783cddc-ea4a-4a36-b207-52360b6634fc', '1ae4e4c7-e5e5-49d8-b781-0a59145524ef', 'error sending request for url (https://api.example.com/leads): client error (Connect): dns error: failed to lookup address information: No address associated with hostname', '2026-01-29 15:11:01.225623+00'),
('e23041ae-69eb-48fa-ad1a-3f920e7b7f6c', '2e8ccb9c-983c-4e64-9494-ef3a2f11335e', '1ae4e4c7-e5e5-49d8-b781-0a59145524ef', 'error sending request for url (https://api.example.com/leads): client error (Connect): dns error: failed to lookup address information: No address associated with hostname', '2026-01-29 15:13:03.084992+00'),
('489b2c55-c70f-4bca-b942-b29822e1afec', '2e8ccb9c-983c-4e64-9494-ef3a2f11335e', '1865cb57-6886-408f-ab31-4f2629cdfa7e', '{"success":false,"message":"Validation failed","errors":{"mobile":["The mobile has already been taken."]}}', '2026-01-29 15:13:03.798404+00'),
('2c10b32b-7ccf-4135-ae47-189cd0dc805c', 'bf907947-5c64-4626-b707-1a0df1d8c00e', '1ae4e4c7-e5e5-49d8-b781-0a59145524ef', 'error sending request for url (https://api.example.com/leads): client error (Connect): dns error: failed to lookup address information: No address associated with hostname', '2026-01-29 15:14:37.63267+00'),
('9c17641b-e0d9-44c9-bfc1-16424d538f7b', 'bf907947-5c64-4626-b707-1a0df1d8c00e', '1865cb57-6886-408f-ab31-4f2629cdfa7e', '{"success":false,"message":"Validation failed","errors":{"mobile":["The mobile has already been taken."]}}', '2026-01-29 15:14:38.43427+00'),
('749f03fd-d4e0-412b-8f7e-cfd1242d445d', '4514b1f6-69a5-4cfd-8bbe-ced26d81dd88', '1ae4e4c7-e5e5-49d8-b781-0a59145524ef', 'error sending request for url (https://api.example.com/leads): client error (Connect): dns error: failed to lookup address information: No address associated with hostname', '2026-01-29 15:14:51.081937+00'),
('c0dfb583-9baa-4d6b-bb5f-ecfc60c1c106', '4514b1f6-69a5-4cfd-8bbe-ced26d81dd88', '1865cb57-6886-408f-ab31-4f2629cdfa7e', '{"success":false,"message":"Validation failed","errors":{"mobile":["The mobile has already been taken."]}}', '2026-01-29 15:15:18.860467+00'),
('1a4c4b2a-2349-46d3-8298-6df9120001a0', 'c6abf20f-57e0-49a8-af0f-9ec8ad076154', '1865cb57-6886-408f-ab31-4f2629cdfa7e', '{"error":"Invalid API token."}', '2026-01-29 20:06:43.860305+00'),
('b7c469b1-f86d-42b9-a713-f92c79d6625c', 'acc91f39-0955-4f3d-a5d6-91db85f82a3e', '1865cb57-6886-408f-ab31-4f2629cdfa7e', '{"error":"Invalid API token."}', '2026-01-29 20:08:07.973953+00'),
('59acb303-1dbe-4a49-9fbe-a191fbf133b1', 'ff395171-dc78-4334-ac0a-348eba8d020d', '1865cb57-6886-408f-ab31-4f2629cdfa7e', '{"error":"Invalid API token."}', '2026-01-29 20:10:51.356324+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 12. TEST LEAD LOGS
-- ============================================
INSERT INTO test_lead_logs (id, advertiser_id, test_data, success, response, created_by, created_at) VALUES
('c1668b7a-5f13-4769-acd3-08c538a3960f', '1865cb57-6886-408f-ab31-4f2629cdfa7e', '{"country":"Canada","country_code":"CA","custom1":"test_1769694734165","email":"william.wilson.1769694734165@yahoo.ca","firstname":"William","ip_address":"186.81.33.41","lastname":"Wilson","mobile":"+1081757241","offer_name":"Test Lead"}', true, '{"success":true,"message":"Lead saved and distributed successfully","count":2,"data":{"leadRequestID":"13eed0b9-4132-4ed8-864f-3d18a2cb851e","lead_id":22114}}', '40fbdec4-99fa-45cb-bace-8274a47fb934', '2026-01-29 13:52:30.172497+00'),
('4f7fb3b9-1fdd-488a-bcfb-5719ff22b8c0', '1865cb57-6886-408f-ab31-4f2629cdfa7e', '{"country":"Canada","country_code":"CA","custom1":"test_1769694943722","email":"jack.smith.1769694943722@outlook.com","firstname":"Jack","ip_address":"196.162.141.20","lastname":"Smith","mobile":"+1956199677","offer_name":"Test Lead"}', true, '{"success":true,"message":"Lead saved and distributed successfully","count":2,"data":{"leadRequestID":"1e3d0ac8-84a4-4c37-9364-197d7bde588a","lead_id":22115}}', '40fbdec4-99fa-45cb-bace-8274a47fb934', '2026-01-29 13:55:53.933293+00'),
('743fb715-94e4-4134-8417-30089660f933', '1865cb57-6886-408f-ab31-4f2629cdfa7e', '{"country":"United States","country_code":"US","email":"daniel.brown.1769731318739@outlook.com","firstname":"Daniel","ip_address":"170.224.212.129","lastname":"Brown","mobile":"+1328807475"}', false, '{"error":"Invalid API token."}', '40fbdec4-99fa-45cb-bace-8274a47fb934', '2026-01-30 00:02:10.698373+00'),
('07301672-861b-4bcf-bb66-48f94cd33ec2', '1865cb57-6886-408f-ab31-4f2629cdfa7e', '{"country":"United States","country_code":"US","email":"michael.smith.1769731340960@icloud.com","firstname":"Michael","ip_address":"9.42.1.127","lastname":"Smith","mobile":"+1457361150"}', false, '{"error":"Invalid API token."}', '40fbdec4-99fa-45cb-bace-8274a47fb934', '2026-01-30 00:03:32.64855+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- NOTES FOR IMPORT
-- ============================================
-- 1. Run migrations first: npx supabase db push --db-url YOUR_DB_URL
-- 2. Create the user in auth.users manually (same UUID: 40fbdec4-99fa-45cb-bace-8274a47fb934)
-- 3. Then run this script
-- 4. Update your app's environment variables to point to your self-hosted Supabase

-- Update crmelite advertiser to use enigma type and add sender config
UPDATE advertisers 
SET advertiser_type = 'enigma',
    config = jsonb_set(COALESCE(config, '{}')::jsonb, '{sender}', '"kiko"')
WHERE name = 'crmelite';
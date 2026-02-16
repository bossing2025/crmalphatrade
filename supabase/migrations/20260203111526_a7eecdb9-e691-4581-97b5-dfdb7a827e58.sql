-- Drop the existing foreign key constraint
ALTER TABLE injection_leads
DROP CONSTRAINT IF EXISTS injection_leads_advertiser_id_fkey;

-- Re-add it with ON DELETE SET NULL to allow advertiser deletion while preserving leads
ALTER TABLE injection_leads
ADD CONSTRAINT injection_leads_advertiser_id_fkey 
FOREIGN KEY (advertiser_id) 
REFERENCES advertisers(id) 
ON DELETE SET NULL;
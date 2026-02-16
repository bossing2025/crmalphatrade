-- Add advertiser_ids array column and migrate existing data
ALTER TABLE public.injections 
ADD COLUMN advertiser_ids UUID[] DEFAULT '{}';

-- Migrate existing advertiser_id to advertiser_ids array
UPDATE public.injections 
SET advertiser_ids = ARRAY[advertiser_id]
WHERE advertiser_id IS NOT NULL;

-- Drop the old advertiser_id column
ALTER TABLE public.injections 
DROP COLUMN advertiser_id;
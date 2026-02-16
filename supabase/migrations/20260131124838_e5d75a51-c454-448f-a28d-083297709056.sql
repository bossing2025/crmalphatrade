-- Make advertiser_id nullable in injections table
ALTER TABLE public.injections 
ALTER COLUMN advertiser_id DROP NOT NULL;
-- Add sale_status column to store raw advertiser status
ALTER TABLE public.leads ADD COLUMN sale_status text DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.leads.sale_status IS 'Raw sale status from advertiser (e.g., Enigma saleStatus)';
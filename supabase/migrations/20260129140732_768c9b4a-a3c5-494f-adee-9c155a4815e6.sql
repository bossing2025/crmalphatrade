-- Add column to store the external lead ID returned by advertisers
ALTER TABLE public.lead_distributions 
ADD COLUMN external_lead_id TEXT;

-- Add column to track when we last polled for this lead
ALTER TABLE public.lead_distributions 
ADD COLUMN last_polled_at TIMESTAMP WITH TIME ZONE;

-- Add status endpoint URL to advertisers for polling
ALTER TABLE public.advertisers 
ADD COLUMN status_endpoint TEXT;

-- Create index for efficient polling queries
CREATE INDEX idx_lead_distributions_status_polling 
ON public.lead_distributions (status, last_polled_at) 
WHERE status = 'sent';
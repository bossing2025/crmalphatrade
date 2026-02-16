-- Add advertiser_id column to injection_leads to track which specific advertiser received each lead
ALTER TABLE public.injection_leads 
ADD COLUMN advertiser_id uuid REFERENCES public.advertisers(id);

-- Create index for better query performance
CREATE INDEX idx_injection_leads_advertiser_id ON public.injection_leads(advertiser_id);
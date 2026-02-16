-- Add a lead_queue table for async processing
CREATE TABLE public.lead_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(lead_id)
);

-- Create index for efficient queue processing
CREATE INDEX idx_lead_queue_pending ON public.lead_queue(status, created_at) WHERE status = 'pending';
CREATE INDEX idx_lead_queue_processing ON public.lead_queue(status, created_at) WHERE status = 'processing';

-- Enable RLS
ALTER TABLE public.lead_queue ENABLE ROW LEVEL SECURITY;

-- Only service role should access this table
CREATE POLICY "Service role only"
ON public.lead_queue
FOR ALL
USING (false)
WITH CHECK (false);
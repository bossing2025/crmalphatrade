-- Create table to track which emails were rejected by which advertisers
CREATE TABLE public.advertiser_email_rejections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  advertiser_id UUID NOT NULL REFERENCES public.advertisers(id) ON DELETE CASCADE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Unique constraint: one entry per email+advertiser combination
  UNIQUE(email, advertiser_id)
);

-- Index for fast lookups by email
CREATE INDEX idx_advertiser_email_rejections_email ON public.advertiser_email_rejections(email);

-- Enable RLS
ALTER TABLE public.advertiser_email_rejections ENABLE ROW LEVEL SECURITY;

-- Service role can manage (used by edge functions)
CREATE POLICY "Service role can manage rejections"
ON public.advertiser_email_rejections
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Staff can view rejections
CREATE POLICY "Staff can view rejections"
ON public.advertiser_email_rejections
FOR SELECT
USING (is_super_admin(auth.uid()) OR is_manager(auth.uid()));

-- Add comment for documentation
COMMENT ON TABLE public.advertiser_email_rejections IS 'Tracks which emails have been rejected by which advertisers to prevent re-sending';
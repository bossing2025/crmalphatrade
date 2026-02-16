-- Add a table to track round-robin position for distribution
CREATE TABLE public.distribution_round_robin (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  last_advertiser_id uuid REFERENCES public.advertisers(id) ON DELETE CASCADE,
  weight_group int NOT NULL DEFAULT 100,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create unique index on weight_group for upsert
CREATE UNIQUE INDEX idx_distribution_round_robin_weight_group ON public.distribution_round_robin(weight_group);

-- Enable RLS
ALTER TABLE public.distribution_round_robin ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table (used by edge functions)
CREATE POLICY "Service role access only"
ON public.distribution_round_robin
FOR ALL
USING (true)
WITH CHECK (true);
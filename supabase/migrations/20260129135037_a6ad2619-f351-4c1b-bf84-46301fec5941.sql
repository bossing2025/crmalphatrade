-- Create test_lead_logs table to track test lead attempts
CREATE TABLE public.test_lead_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  advertiser_id UUID NOT NULL REFERENCES public.advertisers(id) ON DELETE CASCADE,
  test_data JSONB NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  response TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.test_lead_logs ENABLE ROW LEVEL SECURITY;

-- Admins and managers can view and create test logs
CREATE POLICY "Staff can view test logs"
  ON public.test_lead_logs
  FOR SELECT
  USING (is_super_admin(auth.uid()) OR is_manager(auth.uid()));

CREATE POLICY "Staff can create test logs"
  ON public.test_lead_logs
  FOR INSERT
  WITH CHECK (is_super_admin(auth.uid()) OR is_manager(auth.uid()));

-- Only super admins can delete test logs
CREATE POLICY "Super admins can delete test logs"
  ON public.test_lead_logs
  FOR DELETE
  USING (is_super_admin(auth.uid()));
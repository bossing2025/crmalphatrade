-- Phase 1: Hide Instead of Delete - Lead Data Retention System

-- A. Add is_hidden column to lead_pool_leads
ALTER TABLE public.lead_pool_leads 
  ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT false;

-- B. Add is_hidden column to injection_leads
ALTER TABLE public.injection_leads 
  ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT false;

-- C. Make pool_id nullable on lead_pool_leads
ALTER TABLE public.lead_pool_leads 
  ALTER COLUMN pool_id DROP NOT NULL;

-- D. Change foreign key from CASCADE to SET NULL for pool deletion
ALTER TABLE public.lead_pool_leads 
  DROP CONSTRAINT lead_pool_leads_pool_id_fkey;

ALTER TABLE public.lead_pool_leads 
  ADD CONSTRAINT lead_pool_leads_pool_id_fkey 
    FOREIGN KEY (pool_id) 
    REFERENCES public.lead_pools(id) 
    ON DELETE SET NULL;

-- E. Update injection delete trigger to preserve ALL leads (no deletions ever)
CREATE OR REPLACE FUNCTION public.handle_injection_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Preserve ALL leads by setting injection_id to NULL
  -- No leads are ever deleted
  UPDATE injection_leads 
  SET injection_id = NULL 
  WHERE injection_id = OLD.id;
  
  RETURN OLD;
END;
$$;

-- F. Add indexes for performance on is_hidden columns
CREATE INDEX idx_lead_pool_leads_is_hidden 
  ON public.lead_pool_leads(is_hidden);

CREATE INDEX idx_injection_leads_is_hidden 
  ON public.injection_leads(is_hidden);
-- Change injection_leads foreign key from CASCADE to SET NULL
-- This preserves sent leads even when the injection is deleted

ALTER TABLE public.injection_leads 
DROP CONSTRAINT injection_leads_injection_id_fkey;

ALTER TABLE public.injection_leads 
ADD CONSTRAINT injection_leads_injection_id_fkey 
FOREIGN KEY (injection_id) 
REFERENCES public.injections(id) 
ON DELETE SET NULL;

-- Make injection_id nullable to support this
ALTER TABLE public.injection_leads 
ALTER COLUMN injection_id DROP NOT NULL;
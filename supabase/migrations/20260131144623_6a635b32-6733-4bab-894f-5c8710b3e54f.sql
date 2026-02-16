-- Add smart_mode column to injections table for dynamic delay calculation
ALTER TABLE public.injections 
ADD COLUMN smart_mode boolean DEFAULT false;
-- Add ftd_released column to track admin approval
ALTER TABLE public.leads 
ADD COLUMN ftd_released boolean NOT NULL DEFAULT false;

-- Add ftd_released_at timestamp
ALTER TABLE public.leads 
ADD COLUMN ftd_released_at timestamp with time zone;

-- Add ftd_released_by to track who approved
ALTER TABLE public.leads 
ADD COLUMN ftd_released_by uuid;
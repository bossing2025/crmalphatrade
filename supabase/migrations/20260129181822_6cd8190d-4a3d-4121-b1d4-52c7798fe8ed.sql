-- Add allowed_countries column to affiliates table
ALTER TABLE public.affiliates 
ADD COLUMN allowed_countries text[] NULL DEFAULT NULL;

-- NULL means all countries allowed, empty array means no countries, array with codes means only those countries
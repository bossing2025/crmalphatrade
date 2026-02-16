-- First, update any existing advertisers using these types to use 'edgecast' (which will become 'getlinked')
UPDATE public.advertisers
SET advertiser_type = 'edgecast'
WHERE advertiser_type IN ('internal', 'trackbox', 'smart_trade', 'doctormailer', 'dragon_media', 'adscrm', 'revdale', 'custom', 'enigma');

-- Create a new enum type with only getlinked
CREATE TYPE advertiser_type_new AS ENUM ('getlinked');

-- Alter the column to use text temporarily
ALTER TABLE public.advertisers 
ALTER COLUMN advertiser_type DROP DEFAULT;

ALTER TABLE public.advertisers 
ALTER COLUMN advertiser_type TYPE text;

-- Update the value from edgecast to getlinked
UPDATE public.advertisers SET advertiser_type = 'getlinked';

-- Drop the old enum type
DROP TYPE advertiser_type;

-- Rename the new enum type to the original name
ALTER TYPE advertiser_type_new RENAME TO advertiser_type;

-- Convert the column back to the enum type
ALTER TABLE public.advertisers 
ALTER COLUMN advertiser_type TYPE advertiser_type USING advertiser_type::advertiser_type;

-- Set the default to getlinked
ALTER TABLE public.advertisers 
ALTER COLUMN advertiser_type SET DEFAULT 'getlinked'::advertiser_type;
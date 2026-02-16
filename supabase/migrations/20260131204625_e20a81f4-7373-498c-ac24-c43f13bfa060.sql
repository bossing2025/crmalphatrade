-- Add offer_name column to injections table for override functionality
ALTER TABLE injections 
ADD COLUMN offer_name text;
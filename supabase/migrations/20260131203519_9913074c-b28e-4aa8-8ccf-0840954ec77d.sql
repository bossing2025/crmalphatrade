-- Create a trigger to handle injection deletion
-- Preserves 'sent' and 'failed' leads, deletes the rest

CREATE OR REPLACE FUNCTION public.handle_injection_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Preserve sent and failed leads by setting injection_id to NULL
  UPDATE injection_leads 
  SET injection_id = NULL 
  WHERE injection_id = OLD.id 
    AND status IN ('sent', 'failed');
  
  -- Delete pending, scheduled, sending, and skipped leads
  DELETE FROM injection_leads 
  WHERE injection_id = OLD.id 
    AND status IN ('pending', 'scheduled', 'sending', 'skipped');
  
  RETURN OLD;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS before_injection_delete ON injections;
CREATE TRIGGER before_injection_delete
  BEFORE DELETE ON injections
  FOR EACH ROW
  EXECUTE FUNCTION handle_injection_delete();
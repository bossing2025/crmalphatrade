-- Add callback_url to affiliates table for receiving status updates
ALTER TABLE public.affiliates 
ADD COLUMN callback_url text;

-- Add a comment for documentation
COMMENT ON COLUMN public.affiliates.callback_url IS 'Webhook URL where lead status updates will be sent to the affiliate';
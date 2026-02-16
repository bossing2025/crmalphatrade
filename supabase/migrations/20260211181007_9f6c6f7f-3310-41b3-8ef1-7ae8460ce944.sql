
-- Create a security definer function that looks up email by username
-- This bypasses RLS so unauthenticated users can resolve username -> email for login
CREATE OR REPLACE FUNCTION public.get_email_by_username(lookup_username text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM profiles WHERE username = lookup_username LIMIT 1;
$$;

-- Allow anon to call this function
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO authenticated;

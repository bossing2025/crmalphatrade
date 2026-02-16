-- Add username column to profiles table
ALTER TABLE public.profiles ADD COLUMN username TEXT UNIQUE;

-- Create index for faster username lookups
CREATE INDEX idx_profiles_username ON public.profiles(username);

-- Update RLS to allow admins to view all profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = id 
  OR is_super_admin(auth.uid()) 
  OR is_manager(auth.uid())
);

-- Allow super_admin and manager to view all user_roles
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view roles"
ON public.user_roles
FOR SELECT
USING (
  auth.uid() = user_id 
  OR is_super_admin(auth.uid()) 
  OR is_manager(auth.uid())
);
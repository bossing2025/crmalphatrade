-- Drop existing RESTRICTIVE policies on user_roles
DROP POLICY IF EXISTS "Super admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view roles" ON public.user_roles;

-- Create PERMISSIVE policies (AS PERMISSIVE is default but being explicit)
CREATE POLICY "Super admins can manage roles"
ON public.user_roles
AS PERMISSIVE
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Users can view roles"
ON public.user_roles
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR public.is_super_admin(auth.uid()) 
  OR public.is_manager(auth.uid())
);
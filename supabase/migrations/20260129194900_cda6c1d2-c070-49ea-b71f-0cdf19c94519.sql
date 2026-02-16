-- Create enum for permission types
CREATE TYPE public.user_permission AS ENUM (
  'view_phone',
  'view_email', 
  'export_leads',
  'delete_leads',
  'edit_leads',
  'view_all_leads'
);

-- Create user_permissions table
CREATE TABLE public.user_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission user_permission NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission)
);

-- Enable RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Super admins can manage all permissions
CREATE POLICY "Super admins can manage permissions"
ON public.user_permissions
FOR ALL
USING (public.is_super_admin(auth.uid()));

-- Users can view their own permissions, managers can view all
CREATE POLICY "Users can view permissions"
ON public.user_permissions
FOR SELECT
USING (
  auth.uid() = user_id 
  OR public.is_super_admin(auth.uid()) 
  OR public.is_manager(auth.uid())
);

-- Create helper function to check if user has a specific permission
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission user_permission)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Super admins always have all permissions
  SELECT 
    public.is_super_admin(_user_id) 
    OR EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = _user_id AND permission = _permission
    );
$$;
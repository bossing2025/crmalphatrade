-- Add transactional role update function to prevent partial updates
-- and to avoid client-side delete/insert leaving users without roles.

CREATE OR REPLACE FUNCTION public.set_user_roles(_target_user_id uuid, _roles public.app_role[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid;
BEGIN
  _caller := auth.uid();

  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Only super admins may change roles
  IF NOT public.is_super_admin(_caller) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF _roles IS NULL OR array_length(_roles, 1) IS NULL THEN
    RAISE EXCEPTION 'At least one role is required';
  END IF;

  -- Safety: prevent a super admin from removing their own super_admin role
  IF _target_user_id = _caller AND NOT ('super_admin' = ANY(_roles)) THEN
    RAISE EXCEPTION 'You cannot remove your own super_admin role';
  END IF;

  -- Replace roles atomically
  DELETE FROM public.user_roles WHERE user_id = _target_user_id;

  INSERT INTO public.user_roles (user_id, role)
  SELECT _target_user_id, r
  FROM unnest(_roles) AS r;
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_roles(uuid, public.app_role[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_roles(uuid, public.app_role[]) TO authenticated;

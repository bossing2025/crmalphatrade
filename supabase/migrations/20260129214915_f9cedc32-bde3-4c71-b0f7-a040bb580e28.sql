-- Tighten service-only policy to satisfy linter (avoid USING/WITH CHECK true)
DROP POLICY IF EXISTS "Service role access only" ON public.distribution_round_robin;

CREATE POLICY "Service role access only"
ON public.distribution_round_robin
AS PERMISSIVE
FOR ALL
TO authenticated
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Step 1: Drop stale 5-arg check_funder_eligibility overload
DROP FUNCTION IF EXISTS public.check_funder_eligibility(uuid, uuid, uuid, numeric, text);

-- Step 3: Tighten CC votes INSERT policy
DROP POLICY IF EXISTS "CC members can insert own votes" ON public.credit_committee_votes;
CREATE POLICY "CC members can insert own votes"
ON public.credit_committee_votes FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND application_id IN (
    SELECT id FROM credit_committee_applications
    WHERE organization_id = get_user_organization_id(auth.uid())
  )
  AND EXISTS (
    SELECT 1 FROM credit_committee_members
    WHERE user_id = auth.uid()
      AND is_active = true
      AND organization_id = get_user_organization_id(auth.uid())
  )
);

-- Step 4: Tighten notifications INSERT policy
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;
CREATE POLICY "Users or admins can insert notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'originator_admin')
);

-- Step 5: Schedule expiry cron job (graceful if pg_cron not available)
DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'expire-stale-recommendations',
      '0 2 * * *',
      'SELECT public.expire_stale_recommendations()'
    );
  END IF;
END $outer$;
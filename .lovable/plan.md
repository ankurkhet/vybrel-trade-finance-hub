

# Remediation Plan — Combined Gaps (April 5)

## What we're fixing

Three confirmed bugs from Lovable's testing plus two operational gaps from the external report. Step 5 (auto-trigger sanctions on director save) is excluded per your request.

---

## Step 1: Drop stale 5-arg `check_funder_eligibility` overload (Migration)

The old 5-argument version of this function still exists and filters for `status = 'active'` instead of `'approved'`. This creates ambiguity — the database may route calls to the wrong overload.

**Action:** Drop the 5-arg function. The correct 6-arg version (with `_counterparty_id DEFAULT NULL`) already handles all calls.

```sql
DROP FUNCTION IF EXISTS public.check_funder_eligibility(uuid, uuid, uuid, numeric, text);
```

## Step 2: Fix `credit-committee-decide` edge function auth (Edge Function)

Line 29 calls `auth.getClaims(token)` which does not exist in the Supabase JS v2 client. This causes the edge function to fail silently on every invocation.

**Action:** Replace with `auth.getUser()`:
```typescript
const { data: { user }, error: userErr } = await callerClient.auth.getUser();
if (userErr || !user) { return 401 }
const userId = user.id;
```

## Step 3: Tighten CC votes INSERT policy (Migration)

Currently any authenticated user in the same organization can insert votes. The policy should verify the voter is an active member of the credit committee.

**Action:** Replace the INSERT policy to add an `EXISTS` check against `credit_committee_members`:
```sql
DROP POLICY "CC members can insert own votes" ON public.credit_committee_votes;
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
```

## Step 4: Tighten notifications INSERT policy (Migration)

The linter flagged `WITH CHECK (true)` on the notifications INSERT policy, allowing any user to insert notifications targeting other users.

**Action:** Restrict to service-role or self-notifications by requiring the inserted `user_id` matches `auth.uid()` or the inserter has an admin role:
```sql
DROP POLICY "Authenticated can insert notifications" ON public.notifications;
CREATE POLICY "Users or admins can insert notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'originator_admin')
);
```

## Step 5: Schedule expiry cron job (Migration)

The `expire_stale_recommendations()` function exists but is never called. Add a `pg_cron` schedule with graceful fallback.

**Action:**
```sql
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'expire-stale-recommendations',
      '0 2 * * *',
      $$SELECT public.expire_stale_recommendations()$$
    );
  END IF;
END $$;
```

---

## Summary

| Step | Type | Risk | Files |
|------|------|------|-------|
| 1 | Migration | Low | 1 SQL |
| 2 | Edge function | Low | `credit-committee-decide/index.ts` |
| 3 | Migration | Low | 1 SQL |
| 4 | Migration | Low | 1 SQL |
| 5 | Migration | Low | 1 SQL |

Steps 1, 3, 4, 5 go into a single migration. Step 2 is an edge function edit + deploy. Total effort: ~10 minutes.


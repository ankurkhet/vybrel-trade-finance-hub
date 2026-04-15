-- ============================================================
-- Fix auth trigger + backfill profiles
-- Root cause: missing trigger on auth.users meant no profile
-- rows were created on sign-up, causing fetchProfileAndRoles
-- to return empty and loading to hang indefinitely.
-- ============================================================

-- 1. Ensure handle_new_user function is up-to-date
--    (profiles.id = auth.users.id — Arch Fix 1 convention)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

-- 2. Re-create trigger (drop first so it's idempotent across environments)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Backfill profiles for any existing auth users that have no profile row
INSERT INTO public.profiles (id, email, full_name)
SELECT
  u.id,
  u.email,
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    split_part(u.email, '@', 1)
  )
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- 4. Link any admin-role users to the Vybrel platform organisation
--    (no-op if already linked or org doesn't exist)
UPDATE public.profiles p
SET organization_id = (
  SELECT id FROM public.organizations WHERE slug = 'vybrel' LIMIT 1
)
WHERE p.organization_id IS NULL
  AND p.id IN (
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  );

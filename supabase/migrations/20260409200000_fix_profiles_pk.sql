-- ============================================================
-- ARCH FIX 1: profiles.id = auth.users.id
-- The "Vybrel1 bug" fix: profiles.id was a separate auto-generated UUID.
-- Vision mandates profiles.id IS auth.users.id (no separate user_id column).
-- ============================================================

-- Step 1: Drop the old auto-generated PK
ALTER TABLE public.profiles DROP CONSTRAINT profiles_pkey;

-- Step 2: Rename columns (old id → _old_id, user_id → id)
ALTER TABLE public.profiles RENAME COLUMN id TO _old_id;
ALTER TABLE public.profiles RENAME COLUMN user_id TO id;

-- Step 3: Add correct PK on id (= auth.users.id)
ALTER TABLE public.profiles ADD PRIMARY KEY (id);

-- Step 4: Drop dependent policies from other tables that might refer to the old profiles structure
DROP POLICY IF EXISTS "funder_limits_select" ON public.funder_limits;
DROP POLICY IF EXISTS "funder_limits_insert" ON public.funder_limits;
DROP POLICY IF EXISTS "funder_limits_update" ON public.funder_limits;
DROP POLICY IF EXISTS "originator_select_funder_relationships" ON public.funder_relationships;
DROP POLICY IF EXISTS "originator_admin_modify_funder_relationships" ON public.funder_relationships;

-- Step 5: Drop the orphaned old auto-generated id column
ALTER TABLE public.profiles DROP COLUMN _old_id;

-- Step 6: Recreate dependent policies using the new profiles.id structure
CREATE POLICY "funder_limits_select" ON public.funder_limits
    FOR SELECT USING (
        organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) OR funder_user_id = auth.uid()
    );
CREATE POLICY "funder_limits_insert" ON public.funder_limits
    FOR INSERT WITH CHECK (
        organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    );
CREATE POLICY "funder_limits_update" ON public.funder_limits
    FOR UPDATE USING (
        organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) OR funder_user_id = auth.uid()
    );

CREATE POLICY "originator_select_funder_relationships" ON public.funder_relationships
    FOR SELECT USING (
        organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    );
CREATE POLICY "originator_admin_modify_funder_relationships" ON public.funder_relationships
    FOR ALL USING (
        organization_id IN (
            SELECT p.organization_id FROM public.profiles p
            INNER JOIN public.user_roles ur ON ur.user_id = p.id
            WHERE p.id = auth.uid() AND ur.role = 'originator_admin'::app_role
        )
    );

-- Step 7: Update get_user_organization_id() — was: WHERE user_id = _user_id
CREATE OR REPLACE FUNCTION public.get_user_organization_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT organization_id FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

-- Step 8: Update handle_new_user trigger — was: INSERT INTO profiles (user_id, ...)
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
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

-- Step 9: Fix profiles RLS policies (user_id = auth.uid() → id = auth.uid())
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- Admins can view all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Org members can view profiles in their org
DROP POLICY IF EXISTS "Org members can view profiles" ON public.profiles;
CREATE POLICY "Org members can view profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()));

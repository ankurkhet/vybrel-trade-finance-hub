-- ============================================================
-- DEF-001 FIX: Broker RLS isolation
--
-- Problem: Arch Fix 3 (20260409210000) added broad org-scoped SELECT policies for
-- borrowers, invoices, collections, and documents. These were never dropped alongside
-- the pre-existing broker-specific policies (20260317102404), so PostgreSQL evaluates
-- both sets with OR logic — broker_admin could see all org data instead of only their
-- broker_user_id-linked records.
--
-- Fix: Rewrite the four org-scoped SELECT policies to exclude broker_admin users.
-- broker_admin falls through to the dedicated broker policies that enforce
-- broker_user_id = auth.uid() isolation.
-- ============================================================

-- ============================================================
-- borrowers table
-- ============================================================
DROP POLICY IF EXISTS "Borrowers viewable by org members" ON public.borrowers;
CREATE POLICY "Borrowers viewable by org members" ON public.borrowers
  FOR SELECT TO authenticated
  USING (
    (
      organization_id = get_org_from_jwt()
      OR user_id = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
    )
    AND NOT has_role(auth.uid(), 'broker_admin'::app_role)
  );

-- Broker-specific policy (already exists from 20260317102404, kept as-is):
-- "Broker admins can view linked borrowers":
--   has_role(auth.uid(), 'broker_admin') AND broker_user_id = auth.uid()

-- ============================================================
-- invoices table
-- ============================================================
DROP POLICY IF EXISTS "Invoices viewable by org members" ON public.invoices;
CREATE POLICY "Invoices viewable by org members" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    (
      organization_id = get_org_from_jwt()
      OR has_role(auth.uid(), 'admin'::app_role)
    )
    AND NOT has_role(auth.uid(), 'broker_admin'::app_role)
  );

-- Broker-specific policy (already exists from 20260317102404, kept as-is):
-- "Broker admins can view linked invoices":
--   has_role(auth.uid(), 'broker_admin') AND borrower_id IN (SELECT id FROM borrowers WHERE broker_user_id = auth.uid())

-- ============================================================
-- collections table
-- ============================================================
DROP POLICY IF EXISTS "Collections viewable by org members" ON public.collections;
CREATE POLICY "Collections viewable by org members" ON public.collections
  FOR SELECT TO authenticated
  USING (
    (
      organization_id = get_org_from_jwt()
      OR has_role(auth.uid(), 'admin'::app_role)
    )
    AND NOT has_role(auth.uid(), 'broker_admin'::app_role)
  );

-- Broker-specific policy (already exists from 20260317102404, kept as-is):
-- "Broker admins can view linked collections":
--   has_role(auth.uid(), 'broker_admin') AND organization_id = get_user_organization_id(auth.uid())
-- NOTE: The original broker collections policy uses org-wide scope (not borrower-linked).
-- This is intentional — collections are an operational view brokers need across their org.

-- ============================================================
-- documents table
-- ============================================================
DROP POLICY IF EXISTS "Documents viewable by org members" ON public.documents;
CREATE POLICY "Documents viewable by org members" ON public.documents
  FOR SELECT TO authenticated
  USING (
    (
      organization_id = get_org_from_jwt()
      OR has_role(auth.uid(), 'admin'::app_role)
    )
    AND NOT has_role(auth.uid(), 'broker_admin'::app_role)
  );

-- Broker-specific policy (already exists from 20260317102404, kept as-is):
-- "Broker admins can view linked documents":
--   has_role(auth.uid(), 'broker_admin') AND borrower_id IN (SELECT id FROM borrowers WHERE broker_user_id = auth.uid())

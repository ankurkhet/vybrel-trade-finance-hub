-- ============================================================
-- ARCH FIX 3: RLS policies → JWT claims instead of profile joins
-- Replaces get_user_organization_id() calls with JWT app_metadata claims.
-- Uses COALESCE fallback so existing sessions continue to work until re-login.
-- Pattern: (auth.jwt()->'app_metadata'->>'org_id')::uuid
-- ============================================================

-- Helper: get_org_from_jwt() — reads org_id from JWT claim with fallback
CREATE OR REPLACE FUNCTION public.get_org_from_jwt()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (auth.jwt()->'app_metadata'->>'org_id')::uuid,
    public.get_user_organization_id(auth.uid())
  );
$$;

-- ============================================================
-- organizations table
-- ============================================================
DROP POLICY IF EXISTS "Organizations are viewable by org members" ON public.organizations;
CREATE POLICY "Organizations are viewable by org members" ON public.organizations
  FOR SELECT TO authenticated
  USING (
    id = get_org_from_jwt()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- ============================================================
-- borrowers table
-- ============================================================
DROP POLICY IF EXISTS "Borrowers can view their own data" ON public.borrowers;
DROP POLICY IF EXISTS "Org members can view borrowers" ON public.borrowers;
DROP POLICY IF EXISTS "Authenticated users can view borrowers in their org" ON public.borrowers;
CREATE POLICY "Borrowers viewable by org members" ON public.borrowers
  FOR SELECT TO authenticated
  USING (
    organization_id = get_org_from_jwt()
    OR user_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "Borrowers can update their own data" ON public.borrowers;
DROP POLICY IF EXISTS "Org members can insert borrowers" ON public.borrowers;
CREATE POLICY "Borrowers insert by org members" ON public.borrowers
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_org_from_jwt() OR user_id = auth.uid());

CREATE POLICY "Borrowers update by org members" ON public.borrowers
  FOR UPDATE TO authenticated
  USING (organization_id = get_org_from_jwt() OR user_id = auth.uid());

-- ============================================================
-- invoices table
-- ============================================================
DROP POLICY IF EXISTS "Invoices viewable by org members" ON public.invoices;
DROP POLICY IF EXISTS "Org members can view invoices" ON public.invoices;
CREATE POLICY "Invoices viewable by org members" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    organization_id = get_org_from_jwt()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "Invoices insertable by org members" ON public.invoices;
DROP POLICY IF EXISTS "Org members can insert invoices" ON public.invoices;
CREATE POLICY "Invoices insertable by org members" ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_org_from_jwt());

DROP POLICY IF EXISTS "Invoices updatable by org members" ON public.invoices;
DROP POLICY IF EXISTS "Org members can update invoices" ON public.invoices;
CREATE POLICY "Invoices updatable by org members" ON public.invoices
  FOR UPDATE TO authenticated
  USING (organization_id = get_org_from_jwt());

-- ============================================================
-- facility_requests table
-- ============================================================
DROP POLICY IF EXISTS "Facility requests viewable by org members" ON public.facility_requests;
DROP POLICY IF EXISTS "Org members can view facility_requests" ON public.facility_requests;
CREATE POLICY "Facility requests viewable by org members" ON public.facility_requests
  FOR SELECT TO authenticated
  USING (
    organization_id = get_org_from_jwt()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "Facility requests insertable by org members" ON public.facility_requests;
CREATE POLICY "Facility requests insertable by org members" ON public.facility_requests
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_org_from_jwt());

DROP POLICY IF EXISTS "Facility requests updatable by org members" ON public.facility_requests;
CREATE POLICY "Facility requests updatable by org members" ON public.facility_requests
  FOR UPDATE TO authenticated
  USING (organization_id = get_org_from_jwt());

-- ============================================================
-- disbursement_memos table
-- ============================================================
DROP POLICY IF EXISTS "Disbursement memos viewable by org members" ON public.disbursement_memos;
DROP POLICY IF EXISTS "Org members can view disbursement_memos" ON public.disbursement_memos;
CREATE POLICY "Disbursement memos viewable by org members" ON public.disbursement_memos
  FOR SELECT TO authenticated
  USING (
    organization_id = get_org_from_jwt()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "Disbursement memos insertable by org members" ON public.disbursement_memos;
CREATE POLICY "Disbursement memos insertable by org members" ON public.disbursement_memos
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_org_from_jwt());

DROP POLICY IF EXISTS "Disbursement memos updatable by org members" ON public.disbursement_memos;
CREATE POLICY "Disbursement memos updatable by org members" ON public.disbursement_memos
  FOR UPDATE TO authenticated
  USING (organization_id = get_org_from_jwt());

-- ============================================================
-- documents table
-- ============================================================
DROP POLICY IF EXISTS "Documents viewable by org members" ON public.documents;
DROP POLICY IF EXISTS "Org members can view documents" ON public.documents;
CREATE POLICY "Documents viewable by org members" ON public.documents
  FOR SELECT TO authenticated
  USING (
    organization_id = get_org_from_jwt()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "Documents insertable by org members" ON public.documents;
CREATE POLICY "Documents insertable by org members" ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_org_from_jwt());

DROP POLICY IF EXISTS "Documents updatable by org members" ON public.documents;
CREATE POLICY "Documents updatable by org members" ON public.documents
  FOR UPDATE TO authenticated
  USING (organization_id = get_org_from_jwt());

-- ============================================================
-- funder_relationships table
-- ============================================================
DROP POLICY IF EXISTS "Funder relationships viewable by org members" ON public.funder_relationships;
DROP POLICY IF EXISTS "Org members can view funder_relationships" ON public.funder_relationships;
CREATE POLICY "Funder relationships viewable by org members" ON public.funder_relationships
  FOR SELECT TO authenticated
  USING (
    organization_id = get_org_from_jwt()
    OR funder_user_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "Funder relationships insertable by org members" ON public.funder_relationships;
CREATE POLICY "Funder relationships insertable by org members" ON public.funder_relationships
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_org_from_jwt());

DROP POLICY IF EXISTS "Funder relationships updatable by org members" ON public.funder_relationships;
CREATE POLICY "Funder relationships updatable by org members" ON public.funder_relationships
  FOR UPDATE TO authenticated
  USING (organization_id = get_org_from_jwt());

-- ============================================================
-- funder_limits table
-- ============================================================
DROP POLICY IF EXISTS "Funder limits viewable by org members" ON public.funder_limits;
DROP POLICY IF EXISTS "Org members can view funder_limits" ON public.funder_limits;
CREATE POLICY "Funder limits viewable by org members" ON public.funder_limits
  FOR SELECT TO authenticated
  USING (
    organization_id = get_org_from_jwt()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "Funder limits insertable by org members" ON public.funder_limits;
CREATE POLICY "Funder limits insertable by org members" ON public.funder_limits
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_org_from_jwt());

DROP POLICY IF EXISTS "Funder limits updatable by org members" ON public.funder_limits;
CREATE POLICY "Funder limits updatable by org members" ON public.funder_limits
  FOR UPDATE TO authenticated
  USING (organization_id = get_org_from_jwt());

-- ============================================================
-- collections table
-- ============================================================
DROP POLICY IF EXISTS "Collections viewable by org members" ON public.collections;
DROP POLICY IF EXISTS "Org members can view collections" ON public.collections;
CREATE POLICY "Collections viewable by org members" ON public.collections
  FOR SELECT TO authenticated
  USING (
    organization_id = get_org_from_jwt()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "Collections insertable by org members" ON public.collections;
CREATE POLICY "Collections insertable by org members" ON public.collections
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_org_from_jwt());

DROP POLICY IF EXISTS "Collections updatable by org members" ON public.collections;
CREATE POLICY "Collections updatable by org members" ON public.collections
  FOR UPDATE TO authenticated
  USING (organization_id = get_org_from_jwt());

-- ============================================================
-- audit_logs table
-- ============================================================
DROP POLICY IF EXISTS "Audit logs viewable by org members" ON public.audit_logs;
DROP POLICY IF EXISTS "Org members can view audit_logs" ON public.audit_logs;
CREATE POLICY "Audit logs viewable by org members" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    organization_id = get_org_from_jwt()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "Audit logs insertable by authenticated" ON public.audit_logs;
CREATE POLICY "Audit logs insertable by authenticated" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true); -- Any authenticated user can write audit logs

-- ============================================================
-- workflow_event_queue + sanctions_check_queue (from Batch 6 migration)
-- ============================================================
DROP POLICY IF EXISTS "workflow_queue_admin_only" ON public.workflow_event_queue;
CREATE POLICY "workflow_queue_admin_only" ON public.workflow_event_queue
  FOR ALL TO authenticated
  USING (
    organization_id = get_org_from_jwt()
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'originator_admin'::app_role))
  );

DROP POLICY IF EXISTS "sanctions_queue_org_select" ON public.sanctions_check_queue;
CREATE POLICY "sanctions_queue_org_select" ON public.sanctions_check_queue
  FOR SELECT TO authenticated
  USING (organization_id = get_org_from_jwt() OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "sanctions_queue_manage" ON public.sanctions_check_queue;
CREATE POLICY "sanctions_queue_manage" ON public.sanctions_check_queue
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'account_manager'::app_role)
    OR has_role(auth.uid(), 'originator_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

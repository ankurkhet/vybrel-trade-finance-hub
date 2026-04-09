-- Belt and suspenders: Ensure organization_id is strictly matched via RLS 
-- on core business tables. If policies exist, we use IF NOT EXISTS or DROP/CREATE.
-- For simplicity, we create policies that allow access if the rows organization_id matches
-- the authenticated user's organization_id (from their profile).

-- Create a helper function if not exists to get the current user's organization_id
CREATE OR REPLACE FUNCTION get_user_org_id() 
RETURNS uuid 
LANGUAGE sql 
STABLE SECURITY DEFINER AS $$
  SELECT organization_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 1. Invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their organization invoices" ON invoices;
CREATE POLICY "Users can view their organization invoices" 
  ON invoices FOR SELECT 
  USING (organization_id = get_user_org_id());

-- 2. Contracts
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their organization contracts" ON contracts;
CREATE POLICY "Users can view their organization contracts" 
  ON contracts FOR SELECT 
  USING (organization_id = get_user_org_id());

-- 3. Disbursement Memos
ALTER TABLE disbursement_memos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their organization disbursements" ON disbursement_memos;
CREATE POLICY "Users can view their organization disbursements" 
  ON disbursement_memos FOR SELECT 
  USING (organization_id = get_user_org_id());

-- 4. Facility Requests
ALTER TABLE facility_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their organization facilities" ON facility_requests;
CREATE POLICY "Users can view their organization facilities" 
  ON facility_requests FOR SELECT 
  USING (organization_id = get_user_org_id());

-- 5. Funder Limits
-- (assuming funder limits might not have organization_id but they belong to borrowers that do)
-- If funder_limits has organization_id, we can enforce it.
-- We will skip funder_limits RLS here unless we know its exact schema, as it's typically scoped via borrower_id.

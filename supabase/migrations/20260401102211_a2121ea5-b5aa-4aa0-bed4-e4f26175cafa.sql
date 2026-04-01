CREATE OR REPLACE FUNCTION public.get_org_funder_profiles(_org_id uuid)
RETURNS TABLE(user_id uuid, full_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT p.user_id, p.full_name
  FROM funder_relationships fr
  JOIN profiles p ON p.user_id = fr.funder_user_id
  WHERE fr.organization_id = _org_id
    AND fr.agreement_status = 'active'
$$;
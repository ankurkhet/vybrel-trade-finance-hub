// Custom JWT Claims Hook
// This edge function is invoked by Supabase Auth on every sign-in/token refresh.
// It enriches the JWT app_metadata with org_id, role, roles, and entity_id.
// Register via: Supabase Dashboard → Auth → Hooks → Custom Access Token Hook

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const userId: string = payload.user_id;

    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing user_id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Fetch organization from profiles (id = auth.users.id after Arch Fix 1)
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .maybeSingle();

    // Fetch all roles for this user
    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const roles: string[] = (userRoles || []).map((r: any) => r.role);
    const primaryRole: string | null = roles[0] || null;

    // Resolve entity_id based on primary role
    let entity_id: string | null = null;

    if (roles.includes("borrower")) {
      const { data: borrower } = await supabase
        .from("borrowers")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      entity_id = borrower?.id || null;
    } else if (roles.includes("funder")) {
      const { data: funderKyc } = await supabase
        .from("funder_kyc")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      entity_id = funderKyc?.id || null;
    }
    // CC Members and Account Managers: entity_id = null (org-scoped, no entity row)

    const claims = {
      org_id: profile?.organization_id || null,
      role: primaryRole,
      roles,
      entity_id,
    };

    // Supabase custom access token hook requires { claims: { ... } } wrapper
    return new Response(JSON.stringify({ claims }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[custom-jwt-claims] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

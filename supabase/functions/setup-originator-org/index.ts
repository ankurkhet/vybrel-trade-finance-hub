/**
 * setup-originator-org
 *
 * Called on first sign-in after email confirmation when the user has no organization.
 * Creates an organization record, links the profile, and assigns originator_admin role.
 * All in a single call to avoid race conditions.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const body = await req.json().catch(() => ({}));
  const { user_id, company_name } = body;

  // Health check
  if (!user_id) {
    return new Response(
      JSON.stringify({ healthy: true, mode: "health_check" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!company_name) {
    return new Response(
      JSON.stringify({ error: "Missing company_name" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    // Check if profile already has an organization (idempotent guard)
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user_id)
      .single();

    if (existingProfile?.organization_id) {
      return new Response(
        JSON.stringify({ success: true, organization_id: existingProfile.organization_id, already_exists: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Create the organization
    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .insert({
        name: company_name,
        mode: "direct",
        is_active: true,
      })
      .select("id")
      .single();

    if (orgErr || !org) {
      throw new Error(`Failed to create organization: ${orgErr?.message}`);
    }

    // 2. Link profile to the new org
    const { error: profileErr } = await supabase
      .from("profiles")
      .update({ organization_id: org.id })
      .eq("id", user_id);

    if (profileErr) {
      throw new Error(`Failed to link profile: ${profileErr.message}`);
    }

    // 3. Assign originator_admin role
    const { error: roleErr } = await supabase
      .from("user_roles")
      .insert({ user_id, role: "originator_admin" });

    if (roleErr && !roleErr.message?.includes("duplicate")) {
      throw new Error(`Failed to assign role: ${roleErr.message}`);
    }

    console.log(`[setup-originator-org] Created org ${org.id} for user ${user_id} (${company_name})`);

    return new Response(
      JSON.stringify({ success: true, organization_id: org.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[setup-originator-org] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const testUsers = [
      { email: 'originator@test.vybrel.com', password: 'Test1234!', fullName: 'Sarah Chen', role: 'originator_admin' },
      { email: 'borrower@test.vybrel.com', password: 'Test1234!', fullName: 'James Wilson', role: 'borrower' },
      { email: 'funder@test.vybrel.com', password: 'Test1234!', fullName: 'Maria Santos', role: 'funder' },
    ];

    const results: any[] = [];

    // First create a test organization
    const { data: existingOrg } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('slug', 'test-originator')
      .single();

    let orgId: string;
    if (existingOrg) {
      orgId = existingOrg.id;
    } else {
      const { data: newOrg, error: orgErr } = await supabaseAdmin
        .from('organizations')
        .insert({
          name: 'Test Originator Ltd',
          slug: 'test-originator',
          onboarding_status: 'approved',
          is_active: true,
        })
        .select('id')
        .single();
      if (orgErr) throw orgErr;
      orgId = newOrg!.id;
    }

    for (const tu of testUsers) {
      // Check if user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existing = existingUsers?.users?.find(u => u.email === tu.email);

      let userId: string;
      if (existing) {
        userId = existing.id;
        results.push({ email: tu.email, status: 'already exists', userId });
      } else {
        const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: tu.email,
          password: tu.password,
          email_confirm: true,
          user_metadata: { full_name: tu.fullName },
        });
        if (createErr) {
          results.push({ email: tu.email, status: 'error', error: createErr.message });
          continue;
        }
        userId = newUser.user.id;
        results.push({ email: tu.email, status: 'created', userId });
      }

      // Assign role
      await supabaseAdmin.from('user_roles').upsert(
        { user_id: userId, role: tu.role },
        { onConflict: 'user_id,role' }
      );

      // Update profile with org
      await supabaseAdmin.from('profiles').update({
        organization_id: orgId,
      }).eq('user_id', userId);

      // If borrower, create borrower record
      if (tu.role === 'borrower') {
        const { data: existingBorrower } = await supabaseAdmin
          .from('borrowers')
          .select('id')
          .eq('user_id', userId)
          .single();

        if (!existingBorrower) {
          await supabaseAdmin.from('borrowers').insert({
            organization_id: orgId,
            company_name: 'Wilson Trading Co',
            contact_email: tu.email,
            contact_name: tu.fullName,
            country: 'United Kingdom',
            industry: 'manufacturing',
            onboarding_status: 'approved',
            kyc_completed: true,
            user_id: userId,
          });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, orgId, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

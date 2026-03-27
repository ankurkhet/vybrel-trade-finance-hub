import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify caller is admin
    const authHeader = req.headers.get('authorization');
    if (!authHeader) throw new Error('Missing authorization');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const logAudit = async (action: string, resourceType: string, resourceId?: string, details?: Record<string, unknown>) => {
      await supabaseAdmin.from('audit_logs').insert({
        user_id: caller?.id,
        user_email: caller?.email,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        details: details || {},
      });
    };

    let caller: any = null;

    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: callerUser } } = await callerClient.auth.getUser();
    if (!callerUser) throw new Error('Unauthorized');
    caller = callerUser;

    // Verify admin role
    const { data: isAdmin } = await supabaseAdmin.rpc('has_role', {
      _user_id: caller.id,
      _role: 'admin',
    });
    if (!isAdmin) throw new Error('Forbidden: admin role required');

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'list_users': {
        const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        const { data: profiles } = await supabaseAdmin.from('profiles').select('*');
        const { data: userRoles } = await supabaseAdmin.from('user_roles').select('*');
        const { data: orgs } = await supabaseAdmin.from('organizations').select('id, name, slug');
        const { data: borrowerEntities } = await supabaseAdmin.from('borrowers').select('id, company_name, user_id, organization_id');

        const users = (authUsers?.users || []).map(u => {
          const profile = profiles?.find(p => p.user_id === u.id);
          const roles = userRoles?.filter(r => r.user_id === u.id).map(r => r.role) || [];
          const linkedBorrower = borrowerEntities?.find(b => b.user_id === u.id);
          return {
            id: u.id,
            email: u.email,
            full_name: profile?.full_name || u.user_metadata?.full_name || '',
            phone: profile?.phone || '',
            organization_id: profile?.organization_id || null,
            is_active: profile?.is_active ?? true,
            roles,
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at,
            email_confirmed_at: u.email_confirmed_at,
            linked_borrower_id: linkedBorrower?.id || null,
            linked_borrower_name: linkedBorrower?.company_name || null,
          };
        });

        return new Response(JSON.stringify({
          users,
          organizations: orgs || [],
          borrower_entities: (borrowerEntities || []).map(b => ({ id: b.id, company_name: b.company_name, organization_id: b.organization_id })),
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'create_user': {
        const { email, full_name, password, role, organization_id } = body;
        if (!email || !full_name || !role) throw new Error('Missing required fields');

        let userId: string;
        let wasExisting = false;

        const createOpts: any = {
          email,
          email_confirm: true,
          user_metadata: { full_name },
        };
        if (password) createOpts.password = password;

        const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser(createOpts);

        if (createErr) {
          // If user already exists, find them and update instead
          if (createErr.message?.includes('already been registered') || createErr.message?.includes('already exists')) {
            const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
            const existing = listData?.users?.find(u => u.email === email);
            if (!existing) throw new Error(`User with email ${email} exists but could not be found`);
            userId = existing.id;
            wasExisting = true;

            // Update profile name if provided
            await supabaseAdmin.from('profiles').update({ full_name }).eq('user_id', userId);
          } else {
            throw createErr;
          }
        } else {
          userId = newUser.user.id;
        }

        // Assign role (upsert - ignore if already has this role)
        await supabaseAdmin.from('user_roles').upsert(
          { user_id: userId, role },
          { onConflict: 'user_id,role' }
        );

        // Update profile with org
        if (organization_id) {
          await supabaseAdmin.from('profiles').update({ organization_id }).eq('user_id', userId);
        }

        await logAudit('admin.user_create', 'user', userId, { email, role, organization_id, wasExisting });

        return new Response(JSON.stringify({
          success: true,
          userId,
          message: wasExisting
            ? `Existing user ${email} has been assigned the ${role} role`
            : `New account created for ${email}`,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'send_invitation': {
        const { email, full_name, role, organization_id } = body;
        if (!email || !role || !organization_id) throw new Error('Missing required fields');

        // Create invitation record
        const { data: invite, error: invErr } = await supabaseAdmin.from('invitations').insert({
          email,
          role,
          organization_id,
          invited_by: caller.id,
        }).select('token').single();
        if (invErr) throw invErr;

        return new Response(JSON.stringify({ success: true, token: invite.token }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'force_password_reset': {
        const { user_id } = body;
        if (!user_id) throw new Error('Missing user_id');

        // Get user email
        const { data: targetUser } = await supabaseAdmin.auth.admin.getUserById(user_id);
        if (!targetUser?.user?.email) throw new Error('User not found');

        // Generate password reset link
        const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email: targetUser.user.email,
        });
        if (linkErr) throw linkErr;

        await logAudit('admin.force_password_reset', 'user', user_id, { email: targetUser.user.email });

        return new Response(JSON.stringify({
          success: true,
          message: `Password reset link generated for ${targetUser.user.email}`,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'change_email': {
        const { user_id, new_email } = body;
        if (!user_id || !new_email) throw new Error('Missing user_id or new_email');

        // Get old email
        const { data: targetUser } = await supabaseAdmin.auth.admin.getUserById(user_id);
        if (!targetUser?.user?.email) throw new Error('User not found');
        const old_email = targetUser.user.email;

        // Update email in auth
        const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
          email: new_email,
          email_confirm: true,
        });
        if (updateErr) throw updateErr;

        // Update email in profile
        await supabaseAdmin.from('profiles').update({ email: new_email }).eq('user_id', user_id);

        return new Response(JSON.stringify({
          success: true,
          old_email,
          new_email,
          message: `Email changed from ${old_email} to ${new_email}`,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'update_roles': {
        const { user_id, roles } = body;
        if (!user_id || !roles) throw new Error('Missing user_id or roles');

        // Delete existing roles
        await supabaseAdmin.from('user_roles').delete().eq('user_id', user_id);

        // Insert new roles
        if (roles.length > 0) {
          await supabaseAdmin.from('user_roles').insert(
            roles.map((role: string) => ({ user_id, role }))
          );
        }

        await logAudit('admin.user_role_change', 'user', user_id, { roles });

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'update_organization': {
        const { user_id, organization_id } = body;
        if (!user_id) throw new Error('Missing user_id');

        await supabaseAdmin.from('profiles').update({
          organization_id: organization_id || null,
        }).eq('user_id', user_id);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'toggle_active': {
        const { user_id, is_active } = body;
        if (!user_id) throw new Error('Missing user_id');

        await supabaseAdmin.from('profiles').update({ is_active }).eq('user_id', user_id);

        if (!is_active) {
          // Ban user in auth
          await supabaseAdmin.auth.admin.updateUserById(user_id, { ban_duration: '876000h' });
        } else {
          await supabaseAdmin.auth.admin.updateUserById(user_id, { ban_duration: 'none' });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'link_borrower_entity': {
        const { user_id, borrower_id } = body;
        if (!user_id) throw new Error('Missing user_id');

        // Unlink any existing borrower linked to this user
        await supabaseAdmin.from('borrowers').update({ user_id: null }).eq('user_id', user_id);

        // Link new borrower entity if provided
        if (borrower_id) {
          await supabaseAdmin.from('borrowers').update({ user_id }).eq('id', borrower_id);
        }

        await logAudit('admin.link_borrower_entity', 'user', user_id, { borrower_id });

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

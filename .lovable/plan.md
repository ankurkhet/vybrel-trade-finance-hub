

## Fix: Admin Manage Users Edge Function Boot Failure

**Root cause:** Two bugs in `supabase/functions/admin-manage-users/index.ts`:
1. **Duplicate `callerClient` declaration** (lines 37-47) — `const callerClient` is declared twice, causing `SyntaxError: Identifier 'callerClient' has already been declared` at boot
2. **Missing config.toml entry** — `admin-manage-users` function lacks `verify_jwt = false`, which is required for Lovable Cloud

### Changes

**1. `supabase/functions/admin-manage-users/index.ts`** (lines 37-47)
- Remove the first `callerClient` block (lines 37-41) which incorrectly uses `SUPABASE_SERVICE_ROLE_KEY`
- Keep only the second block (lines 43-47) which correctly uses `SUPABASE_ANON_KEY` with the user's auth header
- This is the proper pattern: create a client scoped to the caller's token, then call `getUser()` to verify identity

**2. `supabase/config.toml`**
- Add `[functions.admin-manage-users]` with `verify_jwt = false`

These two fixes will resolve the boot failure and allow the Users page to load.


# Vybrel Onboarding: Creating your Originator Account

To resolve the "Invalid login credentials" error on your live platform, you need to manually create the account in your Supabase project as it was previously pointing to a different instance.

## Option A: The Dashboard Method (Easiest)

1.  **Open Auth Dashboard**: [hngzrhsigrttsqviphlb Auth Users](https://supabase.com/dashboard/project/hngzrhsigrttsqviphlb/auth/users)
2.  **Add User**: Click the blue **"Add user"** button at the top right of the users table.
3.  **Selection**: Select **"Create new user"**.
4.  **Details**:
    *   **Email**: `originator@test.com`
    *   **Password**: `12345678`
5.  **Confirm**: Check the **"Auto-confirm user"** box.
6.  **Create**: Click **"Create user"**.

---

## Option B: The "Fast Fix" via SQL Editor

If you prefer to run a script or if the dashboard method is blocked by domain restrictions, run this in your [SQL Editor](https://supabase.com/dashboard/project/hngzrhsigrttsqviphlb/sql/new):

```sql
-- 1. Enable crypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Create the user manually in the auth and identity tables
-- This ensures the login works immediately with the web app
DO $$
DECLARE
  new_user_id UUID := gen_random_uuid();
  user_email TEXT := 'originator@test.com';
  user_pass TEXT := '12345678';
BEGIN
  -- Insert into auth.users
  INSERT INTO auth.users (
    id, aud, role, email, encrypted_password, 
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, 
    created_at, updated_at, confirmation_token, instance_id
  )
  VALUES (
    new_user_id, 'authenticated', 'authenticated', user_email, 
    crypt(user_pass, gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}', 
    now(), now(), '', '00000000-0000-0000-0000-000000000000'
  ) ON CONFLICT (email) DO NOTHING;

  -- Insert into auth.identities
  INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (
    gen_random_uuid(), 
    (SELECT id FROM auth.users WHERE email = user_email), 
    format('{"sub":"%s","email":"%s"}', (SELECT id FROM auth.users WHERE email = user_email), user_email)::jsonb, 
    'email', now(), now(), now()
  ) ON CONFLICT DO NOTHING;
END $$;
```

---

## After Creation
1.  Navigate to [https://vybrel-abce2.web.app/auth](https://vybrel-abce2.web.app/auth).
2.  Login as **Originator** with `originator@test.com`.
3.  Go to **Lender Management** and authorize your first funder!

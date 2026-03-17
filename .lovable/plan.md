

## Audit Logs Page for Vybrel Admin

### What we're building
A new `/admin/audit-logs` page that shows a searchable, filterable log of all platform activity — user actions, financial transactions, admin operations, etc. This requires:

1. **Database: `audit_logs` table** — stores all audit entries with user, action, resource, details, timestamps
2. **Update `audit-logger.ts`** — connect the existing client-side logger to actually persist entries to the database
3. **Instrument key actions** — add audit logging calls across critical operations (admin user management, auth events, invoice/contract changes)
4. **Admin Audit Logs page** — table with search, date range filter, action category filter, and user filter
5. **Navigation + routing** — add to admin sidebar and App.tsx routes

### Database Migration

```sql
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_email text,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  details jsonb DEFAULT '{}',
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs
CREATE POLICY "Admins can view all audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Any authenticated user can insert (logging their own actions)
CREATE POLICY "Authenticated users can insert audit logs"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Also allow service role inserts from edge functions
CREATE POLICY "Service role can insert audit logs"
  ON public.audit_logs FOR INSERT TO service_role
  WITH CHECK (true);

-- Index for common queries
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs (action);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs (user_id);
```

### Files to Create/Edit

1. **`src/pages/admin/AuditLogs.tsx`** (new) — Main page with:
   - Table showing: timestamp, user email, action, resource type, resource ID, details (expandable)
   - Search bar (filters across email, action, resource)
   - Date range picker (today, 7d, 30d, custom)
   - Action category dropdown (auth, data, financial, compliance, admin)
   - Export to CSV button
   - Pagination

2. **`src/lib/audit-logger.ts`** (edit) — Update `flush()` to actually insert into `audit_logs` table via Supabase client; pass `user_id` from auth session

3. **`src/components/layout/DashboardLayout.tsx`** (edit) — Add "Audit Logs" nav item with `Shield` icon for admin role

4. **`src/App.tsx`** (edit) — Add route `/admin/audit-logs` with `ProtectedRoute requiredRoles={["admin"]}`

5. **`supabase/functions/admin-manage-users/index.ts`** (edit) — Add audit log inserts for admin actions (create user, change email, force password reset, toggle active, role changes)

6. **Key pages to instrument** — Add `auditLogger.log()` calls in:
   - Auth events (login/logout in `useAuth.tsx`)
   - Admin user management actions
   - Invoice/contract creation

### UI Design
- Consistent with existing admin pages (DashboardLayout, Card, Table components)
- Action badges color-coded by category (auth=blue, financial=amber, admin=red, data=gray, compliance=purple)
- Expandable row details showing full JSON payload
- Real-time updates not needed initially — manual refresh button


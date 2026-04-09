-- ============================================================
-- ARCH FIX 6: Standard columns — created_by + deleted_at on core tables
-- Vision: every table has created_by (FK → auth.users), updated_at, deleted_at.
-- updated_at is already present on most tables; this adds the missing columns.
-- ============================================================

-- invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- borrowers
ALTER TABLE public.borrowers
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- collections
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- facility_requests
ALTER TABLE public.facility_requests
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- disbursement_memos (already has created_by from prior migration; add deleted_at)
ALTER TABLE public.disbursement_memos
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- repayment_memos
ALTER TABLE public.repayment_memos
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- organizations (soft delete support)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Universal set_updated_at trigger function (idempotent)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply set_updated_at trigger to tables that are missing it
DO $$
DECLARE
  t TEXT;
  trigger_name TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'invoices', 'borrowers', 'collections', 'facility_requests',
    'repayment_memos', 'organizations'
  ]
  LOOP
    trigger_name := 'set_updated_at_' || t;
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = trigger_name
        AND tgrelid = ('public.' || t)::regclass
    ) THEN
      -- Check table has updated_at column before adding trigger
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = t AND column_name = 'updated_at'
      ) THEN
        EXECUTE format(
          'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
          trigger_name, t
        );
      END IF;
    END IF;
  END LOOP;
END;
$$;

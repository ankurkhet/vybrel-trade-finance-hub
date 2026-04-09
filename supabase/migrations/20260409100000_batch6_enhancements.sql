-- ============================================================
-- BATCH 6: Minor & Operational Enhancements
-- ============================================================

-- Enable pg_net for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ---- 6A: Auto-trigger sanctions check on borrower_directors save ----
-- We insert a notification to the account manager role when a director is
-- added or updated, prompting them to run a sanctions check in the UI.
-- A direct pg_net call to registry-lookup is omitted as it requires a
-- service-role JWT to be stored in vault (out of scope); the queue approach
-- ensures no check is missed while keeping the trigger lightweight.

CREATE TABLE IF NOT EXISTS public.sanctions_check_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    borrower_id UUID NOT NULL,
    director_id UUID NOT NULL,
    director_name TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'cleared', 'flagged'
    checked_at TIMESTAMP WITH TIME ZONE,
    checked_by UUID REFERENCES auth.users(id),
    result JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.sanctions_check_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sanctions_queue_org_select" ON public.sanctions_check_queue
    FOR SELECT TO authenticated
    USING (organization_id = get_user_organization_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "sanctions_queue_manage" ON public.sanctions_check_queue
    FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'account_manager'::app_role) OR has_role(auth.uid(), 'originator_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.queue_director_sanctions_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    _org_id UUID;
    _director_name TEXT;
BEGIN
    SELECT organization_id INTO _org_id FROM public.borrowers WHERE id = NEW.borrower_id;
    _director_name := COALESCE(NEW.first_name || ' ' || NEW.last_name, 'Unknown');

    -- Queue a sanctions check task
    INSERT INTO public.sanctions_check_queue (
        organization_id, borrower_id, director_id, director_name
    ) VALUES (
        COALESCE(_org_id, '00000000-0000-0000-0000-000000000000'::UUID),
        NEW.borrower_id,
        NEW.id,
        _director_name
    )
    ON CONFLICT DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS queue_director_sanctions_check_trigger ON public.borrower_directors;
CREATE TRIGGER queue_director_sanctions_check_trigger
AFTER INSERT OR UPDATE OF first_name, last_name, nationality, date_of_birth
ON public.borrower_directors
FOR EACH ROW
EXECUTE FUNCTION public.queue_director_sanctions_check();

-- ---- 6D: Workflow engine event queue + triggers ----
-- Instead of calling the edge function directly via pg_net (requires vault secret),
-- we create a workflow_event_queue that the workflow-engine edge function polls
-- and processes when invoked.

CREATE TABLE IF NOT EXISTS public.workflow_event_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    event_type TEXT NOT NULL, -- 'status_change'
    old_status TEXT,
    new_status TEXT,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workflow_event_queue_unprocessed
    ON public.workflow_event_queue (processed, created_at)
    WHERE NOT processed;

ALTER TABLE public.workflow_event_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workflow_queue_admin_only" ON public.workflow_event_queue
    FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'originator_admin'::app_role));

-- Generic function for enqueuing workflow events
CREATE OR REPLACE FUNCTION public.enqueue_workflow_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    _org_id UUID;
    _old_status TEXT;
    _new_status TEXT;
BEGIN
    -- Determine status field (invoices / disbursement_memos / credit_committee_applications all use 'status')
    _old_status := OLD.status::TEXT;
    _new_status := NEW.status::TEXT;

    IF _old_status IS NOT DISTINCT FROM _new_status THEN
        RETURN NEW; -- No status change, skip
    END IF;

    _org_id := NEW.organization_id;

    INSERT INTO public.workflow_event_queue (
        organization_id, table_name, record_id, event_type, old_status, new_status
    ) VALUES (
        _org_id,
        TG_TABLE_NAME,
        NEW.id,
        'status_change',
        _old_status,
        _new_status
    );

    RETURN NEW;
END;
$$;

-- Attach to invoices
DROP TRIGGER IF EXISTS workflow_event_invoices_trigger ON public.invoices;
CREATE TRIGGER workflow_event_invoices_trigger
AFTER UPDATE OF status ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_workflow_event();

-- Attach to disbursement_memos
DROP TRIGGER IF EXISTS workflow_event_disbursements_trigger ON public.disbursement_memos;
CREATE TRIGGER workflow_event_disbursements_trigger
AFTER UPDATE OF status ON public.disbursement_memos
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_workflow_event();

-- Attach to credit_committee_applications
DROP TRIGGER IF EXISTS workflow_event_cc_apps_trigger ON public.credit_committee_applications;
CREATE TRIGGER workflow_event_cc_apps_trigger
AFTER UPDATE OF status ON public.credit_committee_applications
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_workflow_event();

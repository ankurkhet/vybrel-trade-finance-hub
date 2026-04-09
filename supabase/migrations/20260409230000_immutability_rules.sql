-- ============================================================
-- ARCH FIX 5: Immutability rules on audit/vote/event tables
-- Vision: journals, audit_logs, cc_votes, workflow_events are all immutable.
-- Currently only journals has no_update/no_delete rules.
-- ============================================================

-- audit_logs: append-only, never update or delete
CREATE RULE no_update_audit_logs AS ON UPDATE TO public.audit_logs DO INSTEAD NOTHING;
CREATE RULE no_delete_audit_logs AS ON DELETE TO public.audit_logs DO INSTEAD NOTHING;

-- cc_votes: votes cast are permanent — integrity of credit committee decisions
CREATE RULE no_update_cc_votes AS ON UPDATE TO public.cc_votes DO INSTEAD NOTHING;
CREATE RULE no_delete_cc_votes AS ON DELETE TO public.cc_votes DO INSTEAD NOTHING;

-- workflow_event_queue: events are immutable once enqueued
-- (processed flag is updated by the workflow engine service role, not users)
CREATE RULE no_delete_workflow_events AS ON DELETE TO public.workflow_event_queue DO INSTEAD NOTHING;

-- sanctions_check_queue: immutable once created
CREATE RULE no_delete_sanctions_queue AS ON DELETE TO public.sanctions_check_queue DO INSTEAD NOTHING;

-- settlement_distributions: immutable if table exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'settlement_distributions'
  ) THEN
    EXECUTE 'CREATE RULE no_update_settlement_distributions AS ON UPDATE TO public.settlement_distributions DO INSTEAD NOTHING';
    EXECUTE 'CREATE RULE no_delete_settlement_distributions AS ON DELETE TO public.settlement_distributions DO INSTEAD NOTHING';
  END IF;
END $$;

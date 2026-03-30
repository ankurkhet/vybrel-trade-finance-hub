-- Migration: Gap Fixes Part 2 (Dunning Engine powered by pg_cron)

-- Create the function to compute daily interest
CREATE OR REPLACE FUNCTION public.accrue_daily_interest()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- This function calculates the daily overdue interest for all 'funded' or 'partially_settled' invoices 
    -- whose due_date has passed.
    -- Formula: daily_charge = invoice_value * (overdue_fee_pct / 100) / 365
    
    UPDATE public.invoices i
    SET 
        accrued_late_fees = COALESCE(i.accrued_late_fees, 0) + (
            i.amount * (
                COALESCE((
                    SELECT f.overdue_fee_pct 
                    FROM public.disbursement_memos dm
                    JOIN public.facility_requests f ON dm.facility_request_id = f.id
                    WHERE dm.invoice_id = i.id
                    LIMIT 1
                ), 0) / 100.0 / 365.0
            )
        ),
        last_dunning_date = CURRENT_DATE
    WHERE 
        i.status IN ('funded', 'partially_settled') AND
        i.due_date < CURRENT_DATE AND
        (i.last_dunning_date IS NULL OR i.last_dunning_date < CURRENT_DATE);
END;
$$;

-- Note: The pg_cron extension must be enabled via the Supabase Dashboard (Database -> Extensions).
-- Assuming it is enabled, we conditionally schedule it:
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_extension
        WHERE extname = 'pg_cron'
    ) THEN
        RAISE EXCEPTION 'pg_cron extension is NOT enabled. Please enable it in the Supabase Dashboard -> Database -> Extensions before running this migration. (GAP-32 Validation)';
    END IF;

    -- Safely unschedule if it exists
    PERFORM cron.unschedule('daily_interest_accrual');
    
    -- Schedule it to run every day at midnight (UTC)
    PERFORM cron.schedule(
        'daily_interest_accrual',
        '0 0 * * *',
        'SELECT public.accrue_daily_interest();'
    );
END
$$;

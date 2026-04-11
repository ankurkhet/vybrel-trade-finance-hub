-- Market Rate Cron Job
-- Schedules fetch-market-rates edge function to run at 07:00 UTC Mon-Fri.
-- Requires: pg_cron and pg_net extensions.

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Helper function called by cron
CREATE OR REPLACE FUNCTION public.invoke_fetch_market_rates()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  base_url  TEXT := current_setting('app.supabase_url', true);
  svc_key   TEXT := current_setting('app.service_role_key', true);
BEGIN
  IF base_url IS NULL OR svc_key IS NULL THEN
    RAISE WARNING '[invoke_fetch_market_rates] app.supabase_url or app.service_role_key not set — skipping';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := base_url || '/functions/v1/fetch-market-rates',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || svc_key
    ),
    body    := '{}'::jsonb
  );
END;
$$;

-- Remove any existing schedule with this name before creating
SELECT cron.unschedule('fetch-market-rates-daily') FROM cron.job WHERE jobname = 'fetch-market-rates-daily';

-- Schedule: 07:00 UTC Monday through Friday
SELECT cron.schedule(
  'fetch-market-rates-daily',
  '0 7 * * 1-5',
  'SELECT public.invoke_fetch_market_rates()'
);

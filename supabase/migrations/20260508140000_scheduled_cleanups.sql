-- ----------------------------------------------------------------------------
-- Scheduled cleanups for the operational tables added in
-- 20260508120000_backend_hardening.sql.
--
-- - rate_limit_buckets: keep 2 hours of data; older rows are useless.
-- - webhook_events: keep 90 days of idempotency keys.
--
-- Uses pg_cron — Supabase enables it on most projects but it's not guaranteed.
-- The whole block is wrapped in a DO ... EXCEPTION so the migration still
-- applies cleanly if pg_cron is unavailable (e.g. self-hosted Postgres
-- without the extension). In that case the cleanup queries can be wired
-- into an external scheduler — they are listed in
-- arris_scheduled_cleanups_doc() as a helper function.
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;

    -- Idempotent (un)schedule pattern: drop the job if it exists, then add it.
    PERFORM cron.unschedule('arris-cleanup-rate-limit-buckets')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'arris-cleanup-rate-limit-buckets');
    PERFORM cron.schedule(
      'arris-cleanup-rate-limit-buckets',
      '*/15 * * * *',
      $job$DELETE FROM public.rate_limit_buckets WHERE ts < now() - interval '2 hours'$job$
    );

    PERFORM cron.unschedule('arris-cleanup-webhook-events')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'arris-cleanup-webhook-events');
    PERFORM cron.schedule(
      'arris-cleanup-webhook-events',
      '17 3 * * *',
      $job$DELETE FROM public.webhook_events WHERE received_at < now() - interval '90 days'$job$
    );

    RAISE NOTICE 'pg_cron cleanup jobs scheduled.';
  ELSE
    RAISE NOTICE 'pg_cron extension is unavailable on this database — wire the cleanup queries into an external scheduler. See arris_scheduled_cleanups_doc().';
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'pg_cron present but the migration user lacks privilege to schedule jobs — skip and wire externally.';
END $$;

-- The cleanup queries as a documented function so they're easy to grep for
-- and easy to run on demand from a SQL editor or external scheduler.
CREATE OR REPLACE FUNCTION public.arris_scheduled_cleanups_doc()
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN '
-- Every 15 minutes:
DELETE FROM public.rate_limit_buckets WHERE ts < now() - interval ''2 hours'';

-- Daily:
DELETE FROM public.webhook_events WHERE received_at < now() - interval ''90 days'';
';
END;
$$;

COMMENT ON FUNCTION public.arris_scheduled_cleanups_doc IS
  'Returns the SQL bodies of the scheduled cleanups so they can be copied into an external scheduler if pg_cron is unavailable.';

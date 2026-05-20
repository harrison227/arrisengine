-- ----------------------------------------------------------------------------
-- Scheduled cleanups for the operational tables added in
-- 20260508120000_backend_hardening.sql.
--
-- - rate_limit_buckets: keep 2 hours of data; older rows are useless.
-- - webhook_events: keep 90 days of idempotency keys.
--
-- Uses pg_cron (Supabase ships with it; just CREATE EXTENSION IF NOT EXISTS).
-- If pg_cron is unavailable (self-hosted Postgres without the extension),
-- the cleanup queries below can be wired into an external scheduler instead;
-- the queries themselves are safe to run on demand.
-- ----------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Rate limit buckets — every 15 minutes, prune anything older than 2 hours.
SELECT cron.schedule(
  'arris-cleanup-rate-limit-buckets',
  '*/15 * * * *',
  $$DELETE FROM public.rate_limit_buckets WHERE ts < now() - interval '2 hours'$$
);

-- Webhook events — daily, prune anything older than 90 days.
SELECT cron.schedule(
  'arris-cleanup-webhook-events',
  '17 3 * * *',
  $$DELETE FROM public.webhook_events WHERE received_at < now() - interval '90 days'$$
);

COMMENT ON EXTENSION pg_cron IS
  'Scheduled jobs: see SELECT * FROM cron.job for the active list.';

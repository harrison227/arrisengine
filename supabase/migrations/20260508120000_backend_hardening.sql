-- ----------------------------------------------------------------------------
-- Backend hardening migration (2026-05-08)
--
-- 1. Adds webhook_events for Stripe + Late idempotency.
-- 2. Adds rate_limit_buckets for cross-isolate rate-limit state.
-- 3. Tightens plan_share_links UPDATE policy and replaces it with a
--    SECURITY DEFINER function so public callers can stamp feedback
--    without needing a broad UPDATE grant.
-- 4. Adds composite indexes on hot query paths flagged in the audit:
--      - tasks(user_id, status, due_date DESC)
--      - contracts(client_id, status)
--      - text_posts(client_id, scheduled_date)
--      - content_pieces(content_plan_id, status)
--
-- All changes are additive. No existing tables/policies are dropped
-- without an immediate replacement, so this can be applied to the live
-- DB without breaking any current callers.
-- ----------------------------------------------------------------------------

-- Webhook idempotency ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,                  -- 'stripe' | 'late' | future providers
  event_id TEXT NOT NULL,                  -- provider's own event id
  event_type TEXT,
  payload_hash TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_webhook_events_provider_event
  ON public.webhook_events (provider, event_id);

CREATE INDEX IF NOT EXISTS idx_webhook_events_received_at
  ON public.webhook_events (received_at DESC);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Only service role writes/reads. No public policies needed.
-- (Edge functions use SUPABASE_SERVICE_ROLE_KEY which bypasses RLS.)

COMMENT ON TABLE public.webhook_events IS
  'Idempotency log for inbound webhooks. Edge functions insert (provider, event_id) on first delivery; duplicates fail unique constraint and are skipped.';


-- Rate limiter ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  id BIGSERIAL PRIMARY KEY,
  bucket TEXT NOT NULL,
  subject TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_lookup
  ON public.rate_limit_buckets (bucket, subject, ts DESC);

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

-- Service-role only. No public policies.
COMMENT ON TABLE public.rate_limit_buckets IS
  'Per-bucket rate-limit attempts. Cleaned periodically; a TTL job is recommended (DELETE WHERE ts < now() - interval ''2 hours'').';


-- plan_share_links UPDATE — replace the broad USING(true) policy ------------
-- Drop the overly permissive policy from 20251230063845.
DROP POLICY IF EXISTS "Anyone can update feedback_submitted_at" ON public.plan_share_links;

-- Replace the policy with a trigger that auto-stamps feedback_submitted_at
-- whenever a row is inserted into plan_feedback. Triggers run as the table
-- owner (postgres), bypassing RLS — so anonymous feedback submissions can
-- still stamp the parent share link without needing a broad UPDATE grant.
CREATE OR REPLACE FUNCTION public.stamp_plan_share_feedback_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.plan_share_links
  SET feedback_submitted_at = now()
  WHERE id = NEW.share_link_id
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_plan_feedback_stamp_share_link ON public.plan_feedback;
CREATE TRIGGER trg_plan_feedback_stamp_share_link
  AFTER INSERT ON public.plan_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.stamp_plan_share_feedback_submitted();

COMMENT ON FUNCTION public.stamp_plan_share_feedback_submitted IS
  'After-insert trigger fn for plan_feedback. Stamps feedback_submitted_at on the parent share link in one atomic step, replacing the dropped "Anyone can update feedback_submitted_at" RLS policy.';


-- Hot-path indexes -----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tasks_user_status_due
  ON public.tasks (user_id, status, due_date DESC);

CREATE INDEX IF NOT EXISTS idx_contracts_client_status
  ON public.contracts (client_id, status);

CREATE INDEX IF NOT EXISTS idx_text_posts_client_scheduled
  ON public.text_posts (client_id, scheduled_date);

CREATE INDEX IF NOT EXISTS idx_content_pieces_plan_status
  ON public.content_pieces (content_plan_id, status);

CREATE INDEX IF NOT EXISTS idx_content_pieces_late_post_id
  ON public.content_pieces (late_post_id) WHERE late_post_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_text_posts_late_post_id
  ON public.text_posts (late_post_id) WHERE late_post_id IS NOT NULL;

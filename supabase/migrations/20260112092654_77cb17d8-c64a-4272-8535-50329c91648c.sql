-- Allow text post sessions to be stored in ai_sessions
ALTER TABLE public.ai_sessions
DROP CONSTRAINT IF EXISTS ai_sessions_session_type_check;

ALTER TABLE public.ai_sessions
ADD CONSTRAINT ai_sessions_session_type_check
CHECK (
  session_type IN ('filming_plan', 'image_batch')
  OR session_type LIKE 'text_posts_%'
);

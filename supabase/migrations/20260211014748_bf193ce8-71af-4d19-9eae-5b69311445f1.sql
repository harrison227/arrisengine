
-- Update ai_sessions RLS: allow team members with client access to view sessions
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.ai_sessions;
CREATE POLICY "Users can view sessions for accessible clients"
  ON public.ai_sessions FOR SELECT
  USING (auth.uid() = user_id OR has_client_access(auth.uid(), client_id));

-- Update image_batch_items RLS: allow team members to view/manage batch items for accessible clients
DROP POLICY IF EXISTS "Users can view batch items from their sessions" ON public.image_batch_items;
CREATE POLICY "Users can view batch items for accessible clients"
  ON public.image_batch_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ai_sessions
      WHERE ai_sessions.id = image_batch_items.session_id
        AND has_client_access(auth.uid(), ai_sessions.client_id)
    )
  );

DROP POLICY IF EXISTS "Users can update batch items in their sessions" ON public.image_batch_items;
CREATE POLICY "Users can update batch items for accessible clients"
  ON public.image_batch_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM ai_sessions
      WHERE ai_sessions.id = image_batch_items.session_id
        AND has_client_access(auth.uid(), ai_sessions.client_id)
    )
  );

DROP POLICY IF EXISTS "Users can delete batch items in their sessions" ON public.image_batch_items;
CREATE POLICY "Users can delete batch items for accessible clients"
  ON public.image_batch_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM ai_sessions
      WHERE ai_sessions.id = image_batch_items.session_id
        AND has_client_access(auth.uid(), ai_sessions.client_id)
    )
  );

DROP POLICY IF EXISTS "Users can create batch items in their sessions" ON public.image_batch_items;
CREATE POLICY "Users can create batch items for accessible clients"
  ON public.image_batch_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_sessions
      WHERE ai_sessions.id = image_batch_items.session_id
        AND has_client_access(auth.uid(), ai_sessions.client_id)
    )
  );

-- Also update image_batch_revisions RLS to match
DROP POLICY IF EXISTS "Users can view revisions of their batch items" ON public.image_batch_revisions;
CREATE POLICY "Users can view revisions for accessible clients"
  ON public.image_batch_revisions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM image_batch_items ibi
      JOIN ai_sessions s ON s.id = ibi.session_id
      WHERE ibi.id = image_batch_revisions.batch_item_id
        AND has_client_access(auth.uid(), s.client_id)
    )
  );

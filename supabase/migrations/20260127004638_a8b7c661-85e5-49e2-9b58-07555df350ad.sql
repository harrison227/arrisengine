-- Add indexes to optimize public calendar queries
-- Index for content_pieces filtered by content_plan_id and scheduled_date
CREATE INDEX IF NOT EXISTS idx_content_pieces_plan_scheduled 
ON public.content_pieces(content_plan_id, scheduled_date);

-- Index for text_posts filtered by client_id, status, and scheduled_date
CREATE INDEX IF NOT EXISTS idx_text_posts_client_status_scheduled 
ON public.text_posts(client_id, status, scheduled_date);

-- Index for calendar_share_links filtered by share_id and is_active
CREATE INDEX IF NOT EXISTS idx_calendar_share_links_share_id 
ON public.calendar_share_links(share_id) WHERE is_active = true;
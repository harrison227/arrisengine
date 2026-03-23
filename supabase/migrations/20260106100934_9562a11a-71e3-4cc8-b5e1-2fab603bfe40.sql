-- Add RLS policy for public access to text_posts via calendar share link
CREATE POLICY "Public can view text posts via active share link"
ON public.text_posts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.calendar_share_links
    WHERE calendar_share_links.client_id = text_posts.client_id
    AND calendar_share_links.is_active = true
  )
);
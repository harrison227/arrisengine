-- Configure CORS for client-assets bucket to allow mobile video loading
-- This enables video playback on mobile browsers which require CORS headers

INSERT INTO storage.buckets (id, name, public, allowed_mime_types)
VALUES (
  'client-assets',
  'client-assets',
  true,
  ARRAY['image/*', 'video/*', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true;

-- Note: Supabase automatically handles CORS for public buckets
-- The issue is likely the crossOrigin attribute - we'll fix that in the component
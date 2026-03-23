-- Allow public access to view client assets (for public calendar views)
CREATE POLICY "Public can view client assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'client-assets');

-- This allows unauthenticated users (clients viewing their calendar) to see videos and images
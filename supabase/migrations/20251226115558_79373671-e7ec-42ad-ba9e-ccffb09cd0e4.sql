-- Create storage bucket for client assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-assets', 'client-assets', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for client-assets bucket
CREATE POLICY "Users can view client assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'client-assets');

CREATE POLICY "Admins can upload client assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'client-assets' AND is_admin_or_owner(auth.uid()));

CREATE POLICY "Admins can update client assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'client-assets' AND is_admin_or_owner(auth.uid()));

CREATE POLICY "Admins can delete client assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'client-assets' AND is_admin_or_owner(auth.uid()));
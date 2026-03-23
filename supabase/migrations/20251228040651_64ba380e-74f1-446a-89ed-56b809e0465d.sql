-- Add Late sync columns to content_pieces
ALTER TABLE public.content_pieces
ADD COLUMN IF NOT EXISTS late_post_id text,
ADD COLUMN IF NOT EXISTS late_sync_status text DEFAULT 'not_synced',
ADD COLUMN IF NOT EXISTS late_last_synced_at timestamptz,
ADD COLUMN IF NOT EXISTS late_error_message text;

-- Add constraint for sync status values
ALTER TABLE public.content_pieces
ADD CONSTRAINT content_pieces_late_sync_status_check 
CHECK (late_sync_status IS NULL OR late_sync_status IN ('synced', 'pending', 'error', 'not_synced'));

-- Add Late credentials to clients table
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS late_api_key text,
ADD COLUMN IF NOT EXISTS late_profile_id text,
ADD COLUMN IF NOT EXISTS late_connected_at timestamptz;

-- Create late_account_mappings table to map platforms to Late account IDs
CREATE TABLE IF NOT EXISTS public.late_account_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform text NOT NULL,
  late_account_id text NOT NULL,
  account_username text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_id, platform)
);

-- Enable RLS on late_account_mappings
ALTER TABLE public.late_account_mappings ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can view account mappings for clients they own
CREATE POLICY "Users can view their own account mappings"
ON public.late_account_mappings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = late_account_mappings.client_id 
    AND clients.user_id = auth.uid()
  )
);

-- RLS policy: Users can insert account mappings for clients they own
CREATE POLICY "Users can insert their own account mappings"
ON public.late_account_mappings
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = late_account_mappings.client_id 
    AND clients.user_id = auth.uid()
  )
);

-- RLS policy: Users can update account mappings for clients they own
CREATE POLICY "Users can update their own account mappings"
ON public.late_account_mappings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = late_account_mappings.client_id 
    AND clients.user_id = auth.uid()
  )
);

-- RLS policy: Users can delete account mappings for clients they own
CREATE POLICY "Users can delete their own account mappings"
ON public.late_account_mappings
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = late_account_mappings.client_id 
    AND clients.user_id = auth.uid()
  )
);
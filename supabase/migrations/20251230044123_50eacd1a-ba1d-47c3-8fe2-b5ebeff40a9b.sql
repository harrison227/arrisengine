-- Create activity_logs table
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  entity_name TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view logs (team visibility)
CREATE POLICY "Team can view activity logs"
  ON public.activity_logs FOR SELECT
  TO authenticated
  USING (true);

-- Users can only insert their own logs
CREATE POLICY "Users can create their own logs"
  ON public.activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for faster queries
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_entity_type ON public.activity_logs(entity_type);

-- Update contracts RLS policies for team access
DROP POLICY IF EXISTS "Users can delete their contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users can update their contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users can view contracts they created" ON public.contracts;

-- New policies: Allow access if user is admin/owner OR has client access OR is the creator
CREATE POLICY "Team can view contracts"
  ON public.contracts FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_owner(auth.uid()) 
    OR public.has_client_access(auth.uid(), client_id)
    OR auth.uid() = user_id
  );

CREATE POLICY "Team can update contracts"
  ON public.contracts FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_or_owner(auth.uid()) 
    OR public.has_client_access(auth.uid(), client_id)
    OR auth.uid() = user_id
  );

CREATE POLICY "Team can delete contracts"
  ON public.contracts FOR DELETE
  TO authenticated
  USING (
    public.is_admin_or_owner(auth.uid()) 
    OR public.has_client_access(auth.uid(), client_id)
    OR auth.uid() = user_id
  );

CREATE POLICY "Team can create contracts"
  ON public.contracts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
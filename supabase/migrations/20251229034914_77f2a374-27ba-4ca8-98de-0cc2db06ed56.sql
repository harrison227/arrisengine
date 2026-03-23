-- Add columns for client change requests
ALTER TABLE public.filming_days
ADD COLUMN client_change_requested BOOLEAN DEFAULT false,
ADD COLUMN client_requested_date DATE,
ADD COLUMN client_requested_time TEXT,
ADD COLUMN client_change_notes TEXT,
ADD COLUMN client_change_requested_at TIMESTAMPTZ;

-- Add policy for public users to request filming day changes via active share links
CREATE POLICY "Public can request filming day changes via active share links"
ON public.filming_days
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.plan_share_links psl
    JOIN public.content_plans cp ON psl.content_plan_id = cp.id
    WHERE cp.client_id = filming_days.client_id
    AND psl.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.plan_share_links psl
    JOIN public.content_plans cp ON psl.content_plan_id = cp.id
    WHERE cp.client_id = filming_days.client_id
    AND psl.is_active = true
  )
);
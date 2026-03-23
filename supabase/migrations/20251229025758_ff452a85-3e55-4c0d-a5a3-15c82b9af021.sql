-- Add strategy_notes column to content_plans
ALTER TABLE public.content_plans 
ADD COLUMN strategy_notes text;

-- Add RLS policy for public access to knowledge_summary via plan share links
CREATE POLICY "Public can view knowledge summary via plan share link"
ON public.knowledge_summary FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.plan_share_links psl
    JOIN public.content_plans cp ON cp.id = psl.content_plan_id
    WHERE cp.client_id = knowledge_summary.client_id
    AND psl.is_active = true
  )
);
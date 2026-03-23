-- Add RLS policy for public contract access via active share links
CREATE POLICY "Public can view contracts via active share link"
ON public.contracts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.contract_share_links
    WHERE contract_share_links.contract_id = contracts.id
    AND contract_share_links.is_active = true
  )
);

-- Add RLS policy for public client info access via contract share links
CREATE POLICY "Public can view client info via contract share link"
ON public.clients FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.contracts c
    JOIN public.contract_share_links csl ON csl.contract_id = c.id
    WHERE c.client_id = clients.id
    AND csl.is_active = true
  )
);
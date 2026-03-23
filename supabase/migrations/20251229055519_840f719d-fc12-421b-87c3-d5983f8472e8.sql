-- Fix plan_share_links policies to allow admins to manage all links
DROP POLICY IF EXISTS "Users can manage their plan share links" ON plan_share_links;

-- Admins/owners can manage ALL plan share links
CREATE POLICY "Admins can manage all plan share links"
ON plan_share_links FOR ALL
TO authenticated
USING (public.is_admin_or_owner(auth.uid()));

-- Users can manage their own plan share links
CREATE POLICY "Users can manage their own plan share links"
ON plan_share_links FOR ALL
TO authenticated
USING (created_by = auth.uid());

-- Fix calendar_share_links - add policy for users with client access
CREATE POLICY "Users with client access can manage calendar share links"
ON calendar_share_links FOR ALL
TO authenticated
USING (public.has_client_access(auth.uid(), client_id));
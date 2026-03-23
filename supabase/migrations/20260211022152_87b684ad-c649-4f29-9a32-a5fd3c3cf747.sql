
-- Allow admins/owners to update any profile's is_approved field
CREATE POLICY "Admins can update profiles"
  ON public.profiles FOR UPDATE
  USING (is_admin_or_owner(auth.uid()));

/*
  # Fix users_profile RLS policies

  ## Problem
  The existing UPDATE policy allows any authenticated user to update any profile row
  as long as they're logged in (auth.uid() IS NOT NULL), which is too permissive.
  The DELETE policy similarly allows any authenticated user to delete any profile.

  ## Changes
  - Drop the overly-permissive UPDATE and DELETE policies
  - Add a policy: admins (role = 'admin') can update any profile
  - Add a policy: users can update only their own profile
  - Add a policy: only admins can delete/deactivate profiles
  - Keep SELECT policy as-is (all authenticated users can view all profiles - needed for dropdowns)
  - Keep INSERT policy as-is (users can insert their own profile on signup)

  ## Security
  - Admins get full control over all profiles
  - Non-admins can only edit their own profile
  - Deletion restricted to admins only
*/

DROP POLICY IF EXISTS "Users can update profiles" ON public.users_profile;
DROP POLICY IF EXISTS "Authenticated users can delete profiles" ON public.users_profile;

CREATE POLICY "Admins can update any profile"
  ON public.users_profile
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users_profile up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users_profile up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

CREATE POLICY "Users can update own profile"
  ON public.users_profile
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can delete profiles"
  ON public.users_profile
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users_profile up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

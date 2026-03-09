/*
  # Fix users_profile SELECT RLS Policy

  ## Summary
  The current SELECT policy uses get_my_role() which creates a circular dependency:
  - To check if user can read profile, it calls get_my_role()
  - get_my_role() tries to read from users_profile
  - This fails because the original SELECT permission hasn't been granted yet

  ## Solution
  Update the policy to ALWAYS allow users to read their own profile first (id = auth.uid()),
  before checking role-based access for reading other profiles.
*/

DROP POLICY IF EXISTS "users_profile_select" ON users_profile;

CREATE POLICY "users_profile_select" ON users_profile
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users_profile up 
      WHERE up.id = auth.uid() 
      AND (
        up.role = 'admin' 
        OR (up.clinic_id IS NOT NULL AND up.clinic_id = users_profile.clinic_id)
      )
    )
  );

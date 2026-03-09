/*
  # Fix Users Profile SELECT Policy Recursion

  ## Summary
  The current SELECT policy on users_profile has infinite recursion because it 
  queries the same table (users_profile) in a subquery to check roles.
  
  This fix uses the get_my_role() and get_my_clinic_id() helper functions instead.
*/

DROP POLICY IF EXISTS "users_profile_select" ON users_profile;

CREATE POLICY "users_profile_select" ON users_profile
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR get_my_role() = 'admin'
    OR (get_my_role() = 'clinic_admin' AND clinic_id = get_my_clinic_id())
    OR (get_my_role() IN ('doctor', 'receptionist') AND clinic_id = get_my_clinic_id())
  );

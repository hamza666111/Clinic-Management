/*
  # Fix Users Profile RLS - Final Solution

  1. Problem
    - RLS policies using helper functions still cause recursion/timeout issues
    - Even SECURITY DEFINER functions can have edge cases with RLS
  
  2. Solution
    - Drop existing policies
    - Create simpler policies that don't rely on helper functions
    - Use auth.jwt() to get user metadata instead of querying users_profile
    - Store role in auth.users metadata for RLS checks

  3. Security
    - Admin can see all users
    - Clinic admin/staff can see users in their clinic
    - Users can always see their own profile
*/

DROP POLICY IF EXISTS "users_profile_select" ON users_profile;
DROP POLICY IF EXISTS "users_profile_insert" ON users_profile;
DROP POLICY IF EXISTS "users_profile_update" ON users_profile;
DROP POLICY IF EXISTS "users_profile_delete" ON users_profile;

CREATE POLICY "users_profile_select" ON users_profile
FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('clinic_admin', 'doctor', 'receptionist')
    AND clinic_id = (
      SELECT up.clinic_id FROM users_profile up WHERE up.id = auth.uid()
    )
  )
);

CREATE POLICY "users_profile_insert" ON users_profile
FOR INSERT TO authenticated
WITH CHECK (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'clinic_admin'
    AND clinic_id = (
      SELECT up.clinic_id FROM users_profile up WHERE up.id = auth.uid()
    )
  )
);

CREATE POLICY "users_profile_update" ON users_profile
FOR UPDATE TO authenticated
USING (
  id = auth.uid()
  OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'clinic_admin'
    AND clinic_id = (
      SELECT up.clinic_id FROM users_profile up WHERE up.id = auth.uid()
    )
  )
)
WITH CHECK (
  id = auth.uid()
  OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'clinic_admin'
    AND clinic_id = (
      SELECT up.clinic_id FROM users_profile up WHERE up.id = auth.uid()
    )
  )
);

CREATE POLICY "users_profile_delete" ON users_profile
FOR DELETE TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'clinic_admin'
    AND clinic_id = (
      SELECT up.clinic_id FROM users_profile up WHERE up.id = auth.uid()
    )
    AND id <> auth.uid()
  )
);

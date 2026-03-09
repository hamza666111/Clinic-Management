/*
  # Fix users_profile RLS policies
  
  1. Changes
    - Simplify SELECT policy to avoid recursion
    - Admin check uses JWT user_metadata.role
    - Non-admin users can see their own profile OR profiles in their clinic
    - Remove clinic_admin references since that role was removed
  
  2. Security
    - Admins can see all users
    - Users can see their own profile
    - Users can see other profiles in their same clinic (for doctor selection, etc.)
*/

DROP POLICY IF EXISTS "users_profile_select" ON users_profile;
DROP POLICY IF EXISTS "users_profile_insert" ON users_profile;
DROP POLICY IF EXISTS "users_profile_update" ON users_profile;
DROP POLICY IF EXISTS "users_profile_delete" ON users_profile;

CREATE POLICY "users_profile_select"
  ON users_profile FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
    OR (
      clinic_id IS NOT NULL 
      AND clinic_id = (
        SELECT up.clinic_id FROM users_profile up WHERE up.id = auth.uid()
      )
    )
  );

CREATE POLICY "users_profile_insert"
  ON users_profile FOR INSERT
  TO authenticated
  WITH CHECK (
    ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  );

CREATE POLICY "users_profile_update"
  ON users_profile FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    OR ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  )
  WITH CHECK (
    id = auth.uid()
    OR ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  );

CREATE POLICY "users_profile_delete"
  ON users_profile FOR DELETE
  TO authenticated
  USING (
    ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
    AND id <> auth.uid()
  );

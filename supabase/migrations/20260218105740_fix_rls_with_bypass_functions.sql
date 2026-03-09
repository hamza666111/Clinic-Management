/*
  # Fix RLS with Bypass Functions

  1. Problem
    - Subqueries in RLS policies still trigger RLS recursively
  
  2. Solution
    - Create helper functions that explicitly bypass RLS using SET ROW_LEVEL_SECURITY = off
    - These functions return current user's clinic_id without triggering RLS
*/

DROP POLICY IF EXISTS "users_profile_select" ON users_profile;
DROP POLICY IF EXISTS "users_profile_insert" ON users_profile;
DROP POLICY IF EXISTS "users_profile_update" ON users_profile;
DROP POLICY IF EXISTS "users_profile_delete" ON users_profile;

CREATE OR REPLACE FUNCTION get_my_clinic_id_bypass()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result uuid;
BEGIN
  SELECT clinic_id INTO result FROM users_profile WHERE id = auth.uid();
  RETURN result;
END;
$$;

CREATE POLICY "users_profile_select" ON users_profile
FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('clinic_admin', 'doctor', 'receptionist')
    AND clinic_id = get_my_clinic_id_bypass()
  )
);

CREATE POLICY "users_profile_insert" ON users_profile
FOR INSERT TO authenticated
WITH CHECK (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'clinic_admin'
    AND clinic_id = get_my_clinic_id_bypass()
  )
);

CREATE POLICY "users_profile_update" ON users_profile
FOR UPDATE TO authenticated
USING (
  id = auth.uid()
  OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'clinic_admin'
    AND clinic_id = get_my_clinic_id_bypass()
  )
)
WITH CHECK (
  id = auth.uid()
  OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'clinic_admin'
    AND clinic_id = get_my_clinic_id_bypass()
  )
);

CREATE POLICY "users_profile_delete" ON users_profile
FOR DELETE TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'clinic_admin'
    AND clinic_id = get_my_clinic_id_bypass()
    AND id <> auth.uid()
  )
);

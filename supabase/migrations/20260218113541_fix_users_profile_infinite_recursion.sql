/*
  # Fix users_profile infinite recursion in RLS

  1. Problem
    - The SELECT policy for users_profile queries users_profile itself to check clinic_id
    - This causes infinite recursion when PostgreSQL evaluates the policy

  2. Solution
    - Create a security definer function to get the current user's clinic_id
    - This function bypasses RLS, preventing recursion
    - Update the SELECT policy to use this function instead of a subquery

  3. Security
    - Function is security definer with restricted permissions
    - Only returns the clinic_id for the authenticated user
*/

-- Create a security definer function to get current user's clinic_id
CREATE OR REPLACE FUNCTION get_my_clinic_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT clinic_id FROM users_profile WHERE id = auth.uid();
$$;

-- Drop the problematic SELECT policy
DROP POLICY IF EXISTS "users_profile_select" ON users_profile;

-- Create a new SELECT policy that uses the function instead of a subquery
CREATE POLICY "users_profile_select"
  ON users_profile
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR ((auth.jwt() -> 'user_metadata') ->> 'role') = 'admin'
    OR (clinic_id IS NOT NULL AND clinic_id = get_my_clinic_id())
  );

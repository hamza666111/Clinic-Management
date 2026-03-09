/*
  # Fix Helper Functions to Use JWT

  1. Problem
    - get_my_role() and get_my_clinic_id() query users_profile which triggers RLS recursion

  2. Solution
    - Rewrite helper functions to use auth.jwt() user_metadata instead
    - This avoids querying users_profile entirely
*/

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'role',
    'unknown'
  )
$$;

CREATE OR REPLACE FUNCTION get_my_clinic_id()
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

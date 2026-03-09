/*
  # Fix Infinite Recursion in RLS Policies

  1. Problem
    - The `get_my_role()` and `get_my_clinic_id()` helper functions query `users_profile`
    - The SELECT policy on `users_profile` calls these functions
    - This creates infinite recursion when RLS evaluates the policy

  2. Solution
    - Recreate helper functions with SECURITY DEFINER to bypass RLS
    - This allows the functions to read `users_profile` without triggering the policy recursion

  3. Security
    - Functions are safe because they only return data for `auth.uid()` (the current user)
    - No user can access another user's role or clinic_id via these functions
*/

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM users_profile WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION get_my_clinic_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT clinic_id FROM users_profile WHERE id = auth.uid()
$$;

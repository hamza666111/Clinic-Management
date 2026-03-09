/*
  # Fix get_my_role() Function
  
  1. Changes
    - Update get_my_role() to use database lookup instead of JWT metadata
    - This ensures role is always current even if JWT hasn't been refreshed
    - Uses SECURITY DEFINER to bypass RLS during the lookup
  
  2. Security
    - Function uses SECURITY DEFINER with restricted search_path
    - Only returns role for the authenticated user
*/

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result text;
BEGIN
  SELECT role INTO result FROM users_profile WHERE id = auth.uid();
  RETURN COALESCE(result, 'unknown');
END;
$$;
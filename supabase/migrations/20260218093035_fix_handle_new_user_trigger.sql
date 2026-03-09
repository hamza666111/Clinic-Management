/*
  # Fix handle_new_user Trigger to Support All Fields

  ## Summary
  Updates the `handle_new_user()` trigger function to handle all user profile fields
  from user_metadata during signup, including clinic_id, role, and is_active.

  ## Changes
  - Modified trigger to extract clinic_id from raw_user_meta_data
  - Ensures proper defaults for all fields
  - Allows seamless user creation via signUp with complete profile data

  ## Security
  - Maintains existing RLS policies
  - No changes to table structure or policies
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO users_profile (id, name, email, role, clinic_id, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'receptionist'),
    (NEW.raw_user_meta_data->>'clinic_id')::uuid,
    COALESCE((NEW.raw_user_meta_data->>'is_active')::boolean, true)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
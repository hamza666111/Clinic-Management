/*
  # Fix User Trigger Timing

  ## Summary
  The handle_new_user trigger runs BEFORE the auth.users row is fully committed,
  which causes a foreign key violation when trying to insert into users_profile.
  
  This migration recreates the trigger to run AFTER INSERT instead.
*/

-- Drop the existing trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Recreate the trigger to fire AFTER INSERT
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

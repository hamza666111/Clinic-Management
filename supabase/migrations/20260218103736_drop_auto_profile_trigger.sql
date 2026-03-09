/*
  # Drop Auto Profile Creation Trigger

  ## Summary
  Remove the automatic profile creation trigger that causes issues with the Supabase Admin API.
  Profile creation will be handled explicitly in the application code (edge functions).
*/

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

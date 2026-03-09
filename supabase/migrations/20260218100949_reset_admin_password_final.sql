/*
  # Reset Admin Password - Final Fix

  ## Summary
  Reset super admin password to a simple, known value

  ## Credentials
  - Email: admin@pearlsmile.com
  - Password: admin123

  ## Changes
  1. Update password hash using bcrypt
  2. Ensure email is confirmed
  3. Set raw_user_meta_data properly
*/

-- Update super admin with proper settings
UPDATE auth.users 
SET 
  encrypted_password = crypt('admin123', gen_salt('bf')),
  email_confirmed_at = now(),
  confirmation_token = '',
  raw_user_meta_data = jsonb_build_object(
    'name', 'Super Admin',
    'role', 'admin'
  ),
  updated_at = now()
WHERE id = 'a1b2c3d4-0000-0000-0000-000000000001';

-- Ensure profile is correct
UPDATE users_profile 
SET 
  name = 'Super Admin',
  role = 'admin',
  clinic_id = NULL,
  is_active = true,
  updated_at = now()
WHERE id = 'a1b2c3d4-0000-0000-0000-000000000001';
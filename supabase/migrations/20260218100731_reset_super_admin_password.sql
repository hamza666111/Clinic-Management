/*
  # Reset Super Admin Password

  ## Summary
  Creates an admin function to update the super admin password to: Admin@123

  ## Changes
  1. Creates a function to update auth.users password
  2. Updates the super admin password to a known value
  3. This is safe to run multiple times

  ## Security
  - This migration should be removed after first run in production
  - Password should be changed immediately after login
*/

-- Update the super admin password
-- Password: Admin@123
UPDATE auth.users 
SET 
  encrypted_password = crypt('Admin@123', gen_salt('bf')),
  updated_at = now()
WHERE email = 'admin@pearlsmile.com';
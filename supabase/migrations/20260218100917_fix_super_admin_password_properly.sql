/*
  # Fix Super Admin Password - Proper Method

  ## Summary
  Properly updates the super admin password using Supabase's password hashing

  ## Changes
  1. Delete and recreate the super admin auth user with known password
  2. Ensure profile is maintained correctly

  ## Credentials
  - Email: admin@pearlsmile.com
  - Password: Admin123!
*/

-- First, ensure the profile exists
INSERT INTO users_profile (id, email, name, role, clinic_id, is_active)
VALUES ('a1b2c3d4-0000-0000-0000-000000000001', 'admin@pearlsmile.com', 'Super Admin', 'admin', NULL, true)
ON CONFLICT (id) DO UPDATE SET
  name = 'Super Admin',
  role = 'admin',
  clinic_id = NULL,
  is_active = true;

-- Update password directly using pgcrypto
UPDATE auth.users 
SET 
  encrypted_password = crypt('Admin123!', gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  updated_at = now()
WHERE id = 'a1b2c3d4-0000-0000-0000-000000000001';
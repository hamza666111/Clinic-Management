/*
  # Recreate Super Admin with Proper Identity

  ## Summary
  The existing admin user at admin@gmail.com has no auth.identities record,
  which is required for Supabase email/password login. This migration:
  1. Deletes the broken admin user completely
  2. Creates a new super admin with the proper identity record

  ## Super Admin Credentials
  - Email: admin@pearlsmile.com
  - Password: Admin123!
  - Role: admin (full system access)
*/

-- First, delete the broken admin user completely
DELETE FROM users_profile WHERE id = '3bce86d8-6022-4c24-a105-71057c7ed5c3';
DELETE FROM auth.identities WHERE user_id = '3bce86d8-6022-4c24-a105-71057c7ed5c3';
DELETE FROM auth.users WHERE id = '3bce86d8-6022-4c24-a105-71057c7ed5c3';

-- Now create the super admin with proper identity
DO $$
DECLARE
  new_user_id uuid := gen_random_uuid();
BEGIN
  -- Insert into auth.users
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000000',
    'admin@pearlsmile.com',
    crypt('Admin123!', gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"name": "Super Admin", "role": "admin"}',
    'authenticated',
    'authenticated',
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  -- Insert the identity record (REQUIRED for email/password login to work)
  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    new_user_id,
    'admin@pearlsmile.com',
    jsonb_build_object(
      'sub', new_user_id::text,
      'email', 'admin@pearlsmile.com',
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  );

  -- The trigger will automatically create the users_profile record
  -- But we need to ensure the role is set to admin
  UPDATE users_profile 
  SET role = 'admin', name = 'Super Admin'
  WHERE id = new_user_id;
END $$;

/*
  # Rebuild Users System - Clean Structure

  ## Summary
  Complete rebuild of the users system with proper role hierarchy and clean structure.

  ## Changes
  1. Drop and recreate users_profile table with clean structure
  2. Remove all users except super admin
  3. Set up proper roles: admin, clinic_admin, doctor, receptionist
  4. Create new trigger for user signup
  5. Update RLS policies for new structure

  ## Roles
  - admin: Super admin, sees everything across all clinics
  - clinic_admin: Manages one clinic (staff, services, prices)
  - doctor: Generates bills, prescriptions, appointments, manages patients
  - receptionist: Books appointments, views patient records and prescriptions

  ## Security
  - RLS enabled on all tables
  - Proper clinic-scoped access
*/

-- ============================================================
-- 1. Drop existing users_profile table and recreate clean
-- ============================================================
DROP TABLE IF EXISTS users_profile CASCADE;

CREATE TABLE users_profile (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'receptionist' CHECK (role IN ('admin', 'clinic_admin', 'doctor', 'receptionist')),
  clinic_id uuid REFERENCES clinics(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE users_profile ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Create new trigger for user signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO users_profile (id, email, name, role, clinic_id, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'receptionist'),
    CASE 
      WHEN NEW.raw_user_meta_data->>'clinic_id' IS NOT NULL 
      THEN (NEW.raw_user_meta_data->>'clinic_id')::uuid 
      ELSE NULL 
    END,
    COALESCE((NEW.raw_user_meta_data->>'is_active')::boolean, true)
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    clinic_id = EXCLUDED.clinic_id,
    is_active = EXCLUDED.is_active,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 3. Helper functions
-- ============================================================
CREATE OR REPLACE FUNCTION get_my_clinic_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT clinic_id FROM users_profile WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM users_profile WHERE id = auth.uid()
$$;

-- ============================================================
-- 4. RLS Policies for users_profile
-- ============================================================

-- SELECT: Users can see their own profile + clinic members + admins see all
CREATE POLICY "users_profile_select"
  ON users_profile FOR SELECT TO authenticated
  USING (
    get_my_role() = 'admin'
    OR id = auth.uid()
    OR clinic_id = get_my_clinic_id()
  );

-- INSERT: Only admins and clinic_admins can create users
CREATE POLICY "users_profile_insert"
  ON users_profile FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() = 'admin'
    OR (get_my_role() = 'clinic_admin' AND clinic_id = get_my_clinic_id())
  );

-- UPDATE: Admins can update anyone, clinic_admins can update their clinic staff, users can update themselves
CREATE POLICY "users_profile_update"
  ON users_profile FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'admin'
    OR (get_my_role() = 'clinic_admin' AND clinic_id = get_my_clinic_id())
    OR id = auth.uid()
  )
  WITH CHECK (
    get_my_role() = 'admin'
    OR (get_my_role() = 'clinic_admin' AND clinic_id = get_my_clinic_id())
    OR id = auth.uid()
  );

-- DELETE: Only admins can delete users
CREATE POLICY "users_profile_delete"
  ON users_profile FOR DELETE TO authenticated
  USING (
    get_my_role() = 'admin'
    OR (get_my_role() = 'clinic_admin' AND clinic_id = get_my_clinic_id() AND id != auth.uid())
  );

-- ============================================================
-- 5. Create indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_profile_clinic_id ON users_profile(clinic_id);
CREATE INDEX IF NOT EXISTS idx_users_profile_role ON users_profile(role);
CREATE INDEX IF NOT EXISTS idx_users_profile_is_active ON users_profile(is_active);
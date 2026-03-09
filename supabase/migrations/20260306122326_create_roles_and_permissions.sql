/*
  # Create Roles and Permissions System

  1. New Tables
    - `clinic_roles`
      - `id` (uuid, primary key)
      - `clinic_id` (uuid, foreign key to clinics)
      - `role_name` (text, unique per clinic)
      - `is_default` (boolean, for doctor/assistant/receptionist)
      - `created_at` (timestamp)
    
    - `role_permissions`
      - `id` (uuid, primary key)
      - `role_id` (uuid, foreign key to clinic_roles)
      - `page_key` (text, dashboard/appointments/invoices/patients/medicines/prescriptions/services/billing)
      - `can_view` (boolean)
      - `can_edit` (boolean)
      - `can_delete` (boolean)
    
    - `role_settings`
      - `id` (uuid, primary key)
      - `role_id` (uuid, foreign key to clinic_roles)
      - `can_view_total_revenue` (boolean)
      - `updated_at` (timestamp)

  2. Changes to users_profile
    - Add `clinic_role_id` (uuid, foreign key to clinic_roles) to link staff to roles

  3. Security
    - Enable RLS on all new tables
    - Add policies so users can only see/manage roles within their clinic
    - Only clinic admins can modify permissions

  4. Important Notes
    - Users from one clinic cannot see or modify data from other clinics
    - Three default roles per clinic: doctor, assistant, receptionist
    - Admins can create custom roles
    - Revenue visibility is controlled per role
*/

CREATE TABLE IF NOT EXISTS clinic_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  role_name text NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(clinic_id, role_name)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES clinic_roles(id) ON DELETE CASCADE,
  page_key text NOT NULL,
  can_view boolean DEFAULT false,
  can_edit boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  UNIQUE(role_id, page_key)
);

CREATE TABLE IF NOT EXISTS role_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES clinic_roles(id) ON DELETE CASCADE UNIQUE,
  can_view_total_revenue boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users_profile' AND column_name = 'clinic_role_id'
  ) THEN
    ALTER TABLE users_profile ADD COLUMN clinic_role_id uuid REFERENCES clinic_roles(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE clinic_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view roles in their clinic"
  ON clinic_roles FOR SELECT
  TO authenticated
  USING (
    clinic_id = (
      SELECT clinic_id FROM users_profile WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM users_profile
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Clinic admins can manage roles"
  ON clinic_roles FOR ALL
  TO authenticated
  USING (
    clinic_id = (
      SELECT clinic_id FROM users_profile WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM users_profile
      WHERE id = auth.uid() AND role IN ('admin', 'clinic_admin')
    )
  )
  WITH CHECK (
    clinic_id = (
      SELECT clinic_id FROM users_profile WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM users_profile
      WHERE id = auth.uid() AND role IN ('admin', 'clinic_admin')
    )
  );

CREATE POLICY "Users can view permissions for their clinic roles"
  ON role_permissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clinic_roles cr
      WHERE cr.id = role_permissions.role_id
      AND (
        cr.clinic_id = (SELECT clinic_id FROM users_profile WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM users_profile WHERE id = auth.uid() AND role = 'admin')
      )
    )
  );

CREATE POLICY "Clinic admins can manage permissions"
  ON role_permissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clinic_roles cr
      WHERE cr.id = role_permissions.role_id
      AND cr.clinic_id = (SELECT clinic_id FROM users_profile WHERE id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM users_profile
        WHERE id = auth.uid() AND role IN ('admin', 'clinic_admin')
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clinic_roles cr
      WHERE cr.id = role_permissions.role_id
      AND cr.clinic_id = (SELECT clinic_id FROM users_profile WHERE id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM users_profile
        WHERE id = auth.uid() AND role IN ('admin', 'clinic_admin')
      )
    )
  );

CREATE POLICY "Users can view role settings for their clinic"
  ON role_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clinic_roles cr
      WHERE cr.id = role_settings.role_id
      AND (
        cr.clinic_id = (SELECT clinic_id FROM users_profile WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM users_profile WHERE id = auth.uid() AND role = 'admin')
      )
    )
  );

CREATE POLICY "Clinic admins can manage role settings"
  ON role_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clinic_roles cr
      WHERE cr.id = role_settings.role_id
      AND cr.clinic_id = (SELECT clinic_id FROM users_profile WHERE id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM users_profile
        WHERE id = auth.uid() AND role IN ('admin', 'clinic_admin')
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clinic_roles cr
      WHERE cr.id = role_settings.role_id
      AND cr.clinic_id = (SELECT clinic_id FROM users_profile WHERE id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM users_profile
        WHERE id = auth.uid() AND role IN ('admin', 'clinic_admin')
      )
    )
  );

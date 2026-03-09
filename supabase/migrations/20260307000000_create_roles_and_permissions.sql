-- Migration: Create dynamic roles, permissions, and service categories

-- 1. Create hierarchical Service Categories
CREATE TABLE service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES clinics(id) ON DELETE CASCADE, -- Null means global/system category
  parent_id uuid REFERENCES service_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;

-- 2. Modify Dental Services to link to explicitly typed categories
ALTER TABLE dental_services 
ADD COLUMN category_id uuid REFERENCES service_categories(id) ON DELETE SET NULL;

-- 3. Isolate Doctors & Assistants by Service Categories
CREATE TABLE user_service_categories (
  user_id uuid REFERENCES users_profile(id) ON DELETE CASCADE,
  category_id uuid REFERENCES service_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, category_id)
);
ALTER TABLE user_service_categories ENABLE ROW LEVEL SECURITY;

-- 4. Create Roles Table (Allowing Custom Roles per clinic)
CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES clinics(id) ON DELETE CASCADE, -- Null means a universal default role
  name text NOT NULL,
  description text,
  is_system_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Insert defaults
INSERT INTO roles (name, is_system_default) VALUES 
('admin', true), ('clinic_admin', true), ('doctor', true), ('assistant', true), ('receptionist', true);

-- 5. Create Permissions Mapping
CREATE TABLE role_permissions (
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE,
  permission_key text NOT NULL, -- e.g., 'view_revenue', 'view_portal_dashboard'
  can_read boolean DEFAULT false,
  can_write boolean DEFAULT false,
  PRIMARY KEY (role_id, permission_key)
);
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Associate defaults to revenue
INSERT INTO role_permissions (role_id, permission_key, can_read, can_write)
SELECT id, 'view_revenue', true, true FROM roles WHERE name IN ('admin', 'clinic_admin');

-- 6. Transition users_profile to use dynamic roles safely
-- (Drops the harsh ENUM check and adds a FK relation while keeping string compatibility)
ALTER TABLE users_profile 
DROP CONSTRAINT IF EXISTS users_profile_role_check;

ALTER TABLE users_profile 
ADD COLUMN dynamic_role_id uuid REFERENCES roles(id) ON DELETE SET NULL;

-- Simple migration to link existing strings to standard roles
UPDATE users_profile up
SET dynamic_role_id = r.id
FROM roles r
WHERE up.role = r.name AND r.is_system_default = true;

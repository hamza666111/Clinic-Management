/*
  Ensure assistant role and portal page permissions exist for the dynamic roles model.
  This migration is safe to run multiple times.
*/

ALTER TABLE public.users_profile
DROP CONSTRAINT IF EXISTS users_profile_role_check;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'roles'
  ) THEN
    INSERT INTO public.roles (name, is_system_default)
    SELECT role_name, true
    FROM (VALUES ('admin'), ('clinic_admin'), ('doctor'), ('assistant'), ('receptionist')) AS defaults(role_name)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.roles r
      WHERE r.name = defaults.role_name
        AND r.is_system_default = true
    );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users_profile' AND column_name = 'dynamic_role_id'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'roles'
  ) THEN
    UPDATE public.users_profile up
    SET dynamic_role_id = r.id
    FROM public.roles r
    WHERE up.dynamic_role_id IS NULL
      AND r.is_system_default = true
      AND up.role = r.name;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'role_permissions' AND column_name = 'permission_key'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'role_permissions' AND column_name = 'can_read'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'role_permissions' AND column_name = 'can_write'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'roles'
  ) THEN
    WITH default_permissions(role_name, permission_key, can_read, can_write) AS (
      VALUES
        ('admin', 'view_dashboard', true, true),
        ('admin', 'manage_patients', true, true),
        ('admin', 'manage_appointments', true, true),
        ('admin', 'manage_prescriptions', true, true),
        ('admin', 'manage_billing', true, true),
        ('admin', 'manage_services', true, true),
        ('admin', 'manage_medicines', true, true),
        ('admin', 'manage_users', true, true),
        ('admin', 'manage_staff_roles', true, true),
        ('admin', 'manage_clinics', true, true),
        ('admin', 'view_revenue', true, true),

        ('clinic_admin', 'view_dashboard', true, true),
        ('clinic_admin', 'manage_patients', true, true),
        ('clinic_admin', 'manage_appointments', true, true),
        ('clinic_admin', 'manage_prescriptions', true, true),
        ('clinic_admin', 'manage_billing', true, true),
        ('clinic_admin', 'manage_services', true, true),
        ('clinic_admin', 'manage_medicines', true, true),
        ('clinic_admin', 'manage_users', true, true),
        ('clinic_admin', 'manage_staff_roles', true, true),
        ('clinic_admin', 'manage_clinics', false, false),
        ('clinic_admin', 'view_revenue', true, true),

        ('doctor', 'view_dashboard', true, true),
        ('doctor', 'manage_patients', true, true),
        ('doctor', 'manage_appointments', true, true),
        ('doctor', 'manage_prescriptions', true, true),
        ('doctor', 'manage_billing', true, true),
        ('doctor', 'manage_services', true, true),
        ('doctor', 'manage_medicines', true, true),
        ('doctor', 'manage_users', false, false),
        ('doctor', 'manage_staff_roles', false, false),
        ('doctor', 'manage_clinics', false, false),
        ('doctor', 'view_revenue', false, false),

        ('assistant', 'view_dashboard', true, true),
        ('assistant', 'manage_patients', true, true),
        ('assistant', 'manage_appointments', true, true),
        ('assistant', 'manage_prescriptions', false, false),
        ('assistant', 'manage_billing', false, false),
        ('assistant', 'manage_services', false, false),
        ('assistant', 'manage_medicines', true, true),
        ('assistant', 'manage_users', false, false),
        ('assistant', 'manage_staff_roles', false, false),
        ('assistant', 'manage_clinics', false, false),
        ('assistant', 'view_revenue', false, false),

        ('receptionist', 'view_dashboard', true, true),
        ('receptionist', 'manage_patients', true, true),
        ('receptionist', 'manage_appointments', true, true),
        ('receptionist', 'manage_prescriptions', false, false),
        ('receptionist', 'manage_billing', true, true),
        ('receptionist', 'manage_services', true, true),
        ('receptionist', 'manage_medicines', true, true),
        ('receptionist', 'manage_users', false, false),
        ('receptionist', 'manage_staff_roles', false, false),
        ('receptionist', 'manage_clinics', false, false),
        ('receptionist', 'view_revenue', false, false)
    )
    INSERT INTO public.role_permissions (role_id, permission_key, can_read, can_write)
    SELECT r.id, dp.permission_key, dp.can_read, dp.can_write
    FROM default_permissions dp
    JOIN public.roles r
      ON r.name = dp.role_name
     AND r.is_system_default = true
    ON CONFLICT (role_id, permission_key) DO NOTHING;
  END IF;
END $$;

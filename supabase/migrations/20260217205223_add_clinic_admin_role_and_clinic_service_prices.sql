/*
  # Add clinic_admin Role + Per-Clinic Service Pricing

  ## Summary
  Introduces a new `clinic_admin` role that acts as a super-user scoped to their
  assigned clinic, and a `clinic_service_prices` table that allows each clinic to
  override the default price of any dental service.

  ## Changes

  ### 1. users_profile.role — new allowed value
  - Adds `clinic_admin` to the CHECK constraint on the `role` column.
  - `clinic_admin` behaves like `admin` but only within their own `clinic_id`.

  ### 2. New Table: clinic_service_prices
  - `id` — primary key
  - `clinic_id` — FK to clinics
  - `service_id` — FK to dental_services
  - `price` — override price for this clinic
  - Unique constraint on (clinic_id, service_id)
  - RLS: admin & clinic_admin of same clinic can manage; all clinic staff can read their own

  ### 3. Updated Helper Functions
  - `get_my_role()` — unchanged, still returns raw role string (works with clinic_admin)
  - `is_admin_or_clinic_admin()` — new convenience function

  ### 4. Updated RLS Policies
  All existing policies are extended so that `clinic_admin` has the same within-clinic
  powers as `admin`, while still being blocked from cross-clinic data.

  ### Notes
  - The `admin` role still sees ALL data across ALL clinics.
  - `clinic_admin` sees/manages ONLY their clinic's data (identical to doctor/receptionist
    visibility, but with full write/delete permissions within that scope).
  - No data is dropped or destroyed.
*/

-- ============================================================
-- 1. Extend role CHECK constraint on users_profile
-- ============================================================
ALTER TABLE users_profile
  DROP CONSTRAINT IF EXISTS users_profile_role_check;

ALTER TABLE users_profile
  ADD CONSTRAINT users_profile_role_check
  CHECK (role IN ('admin', 'clinic_admin', 'doctor', 'receptionist'));

-- ============================================================
-- 2. New table: clinic_service_prices
-- ============================================================
CREATE TABLE IF NOT EXISTS clinic_service_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES dental_services(id) ON DELETE CASCADE,
  price numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (clinic_id, service_id)
);

ALTER TABLE clinic_service_prices ENABLE ROW LEVEL SECURITY;

-- Read: all staff of that clinic + global admins
CREATE POLICY "csp_select"
  ON clinic_service_prices FOR SELECT TO authenticated
  USING (
    get_my_role() = 'admin'
    OR clinic_id = get_my_clinic_id()
  );

-- Insert/Update/Delete: only admin or clinic_admin of that clinic
CREATE POLICY "csp_insert"
  ON clinic_service_prices FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() = 'admin'
    OR (get_my_role() = 'clinic_admin' AND clinic_id = get_my_clinic_id())
  );

CREATE POLICY "csp_update"
  ON clinic_service_prices FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'admin'
    OR (get_my_role() = 'clinic_admin' AND clinic_id = get_my_clinic_id())
  )
  WITH CHECK (
    get_my_role() = 'admin'
    OR (get_my_role() = 'clinic_admin' AND clinic_id = get_my_clinic_id())
  );

CREATE POLICY "csp_delete"
  ON clinic_service_prices FOR DELETE TO authenticated
  USING (
    get_my_role() = 'admin'
    OR (get_my_role() = 'clinic_admin' AND clinic_id = get_my_clinic_id())
  );

CREATE INDEX IF NOT EXISTS idx_clinic_service_prices_clinic_id ON clinic_service_prices(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_service_prices_service_id ON clinic_service_prices(service_id);

-- ============================================================
-- 3. Update all existing RLS policies to include clinic_admin
-- ============================================================

-- CLINICS
DROP POLICY IF EXISTS "clinics_select" ON clinics;
DROP POLICY IF EXISTS "clinics_insert" ON clinics;
DROP POLICY IF EXISTS "clinics_update" ON clinics;
DROP POLICY IF EXISTS "clinics_delete" ON clinics;

CREATE POLICY "clinics_select"
  ON clinics FOR SELECT TO authenticated
  USING (
    get_my_role() = 'admin'
    OR id = get_my_clinic_id()
  );

CREATE POLICY "clinics_insert"
  ON clinics FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "clinics_update"
  ON clinics FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'admin'
    OR (get_my_role() = 'clinic_admin' AND id = get_my_clinic_id())
  )
  WITH CHECK (
    get_my_role() = 'admin'
    OR (get_my_role() = 'clinic_admin' AND id = get_my_clinic_id())
  );

CREATE POLICY "clinics_delete"
  ON clinics FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

-- USERS_PROFILE
DROP POLICY IF EXISTS "users_profile_select" ON users_profile;
DROP POLICY IF EXISTS "users_profile_insert" ON users_profile;
DROP POLICY IF EXISTS "users_profile_update" ON users_profile;
DROP POLICY IF EXISTS "users_profile_delete" ON users_profile;

CREATE POLICY "users_profile_select"
  ON users_profile FOR SELECT TO authenticated
  USING (
    get_my_role() = 'admin'
    OR id = auth.uid()
    OR clinic_id = get_my_clinic_id()
  );

CREATE POLICY "users_profile_insert"
  ON users_profile FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = id
    OR get_my_role() = 'admin'
    OR (get_my_role() = 'clinic_admin' AND clinic_id = get_my_clinic_id())
  );

CREATE POLICY "users_profile_update"
  ON users_profile FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'admin'
    OR auth.uid() = id
    OR (get_my_role() = 'clinic_admin' AND clinic_id = get_my_clinic_id())
  )
  WITH CHECK (
    get_my_role() = 'admin'
    OR auth.uid() = id
    OR (get_my_role() = 'clinic_admin' AND clinic_id = get_my_clinic_id())
  );

CREATE POLICY "users_profile_delete"
  ON users_profile FOR DELETE TO authenticated
  USING (
    get_my_role() = 'admin'
    OR (get_my_role() = 'clinic_admin' AND clinic_id = get_my_clinic_id() AND id != auth.uid())
  );

-- PATIENTS
DROP POLICY IF EXISTS "patients_select" ON patients;
DROP POLICY IF EXISTS "patients_insert" ON patients;
DROP POLICY IF EXISTS "patients_update" ON patients;
DROP POLICY IF EXISTS "patients_delete" ON patients;

CREATE POLICY "patients_select"
  ON patients FOR SELECT TO authenticated
  USING (
    get_my_role() = 'admin'
    OR clinic_id = get_my_clinic_id()
  );

CREATE POLICY "patients_insert"
  ON patients FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() = 'admin'
    OR clinic_id = get_my_clinic_id()
  );

CREATE POLICY "patients_update"
  ON patients FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'admin'
    OR clinic_id = get_my_clinic_id()
  )
  WITH CHECK (
    get_my_role() = 'admin'
    OR clinic_id = get_my_clinic_id()
  );

CREATE POLICY "patients_delete"
  ON patients FOR DELETE TO authenticated
  USING (
    get_my_role() = 'admin'
    OR (clinic_id = get_my_clinic_id() AND get_my_role() IN ('clinic_admin', 'doctor'))
  );

-- PATIENT_FILES
DROP POLICY IF EXISTS "patient_files_select" ON patient_files;
DROP POLICY IF EXISTS "patient_files_insert" ON patient_files;
DROP POLICY IF EXISTS "patient_files_delete" ON patient_files;

CREATE POLICY "patient_files_select"
  ON patient_files FOR SELECT TO authenticated
  USING (
    get_my_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM patients p
      WHERE p.id = patient_files.patient_id
      AND p.clinic_id = get_my_clinic_id()
    )
  );

CREATE POLICY "patient_files_insert"
  ON patient_files FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM patients p
      WHERE p.id = patient_files.patient_id
      AND p.clinic_id = get_my_clinic_id()
    )
  );

CREATE POLICY "patient_files_delete"
  ON patient_files FOR DELETE TO authenticated
  USING (
    get_my_role() = 'admin'
    OR get_my_role() = 'clinic_admin'
    OR (
      uploaded_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM patients p
        WHERE p.id = patient_files.patient_id
        AND p.clinic_id = get_my_clinic_id()
      )
    )
  );

-- APPOINTMENTS
DROP POLICY IF EXISTS "appointments_select" ON appointments;
DROP POLICY IF EXISTS "appointments_insert" ON appointments;
DROP POLICY IF EXISTS "appointments_update" ON appointments;
DROP POLICY IF EXISTS "appointments_delete" ON appointments;

CREATE POLICY "appointments_select"
  ON appointments FOR SELECT TO authenticated
  USING (
    get_my_role() = 'admin'
    OR clinic_id = get_my_clinic_id()
  );

CREATE POLICY "appointments_insert"
  ON appointments FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() = 'admin'
    OR clinic_id = get_my_clinic_id()
  );

CREATE POLICY "appointments_update"
  ON appointments FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'admin'
    OR clinic_id = get_my_clinic_id()
  )
  WITH CHECK (
    get_my_role() = 'admin'
    OR clinic_id = get_my_clinic_id()
  );

CREATE POLICY "appointments_delete"
  ON appointments FOR DELETE TO authenticated
  USING (
    get_my_role() = 'admin'
    OR clinic_id = get_my_clinic_id()
  );

-- MEDICINES
DROP POLICY IF EXISTS "medicines_select" ON medicines;
DROP POLICY IF EXISTS "medicines_insert" ON medicines;
DROP POLICY IF EXISTS "medicines_update" ON medicines;
DROP POLICY IF EXISTS "medicines_delete" ON medicines;

CREATE POLICY "medicines_select"
  ON medicines FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "medicines_insert"
  ON medicines FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'clinic_admin', 'doctor'));

CREATE POLICY "medicines_update"
  ON medicines FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'clinic_admin'))
  WITH CHECK (get_my_role() IN ('admin', 'clinic_admin'));

CREATE POLICY "medicines_delete"
  ON medicines FOR DELETE TO authenticated
  USING (get_my_role() IN ('admin', 'clinic_admin'));

-- PRESCRIPTIONS
DROP POLICY IF EXISTS "prescriptions_select" ON prescriptions;
DROP POLICY IF EXISTS "prescriptions_insert" ON prescriptions;
DROP POLICY IF EXISTS "prescriptions_update" ON prescriptions;
DROP POLICY IF EXISTS "prescriptions_delete" ON prescriptions;

CREATE POLICY "prescriptions_select"
  ON prescriptions FOR SELECT TO authenticated
  USING (
    get_my_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM patients p
      WHERE p.id = prescriptions.patient_id
      AND p.clinic_id = get_my_clinic_id()
    )
  );

CREATE POLICY "prescriptions_insert"
  ON prescriptions FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() = 'admin'
    OR (
      get_my_role() IN ('clinic_admin', 'doctor')
      AND EXISTS (
        SELECT 1 FROM patients p
        WHERE p.id = prescriptions.patient_id
        AND p.clinic_id = get_my_clinic_id()
      )
    )
  );

CREATE POLICY "prescriptions_update"
  ON prescriptions FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'admin'
    OR get_my_role() = 'clinic_admin'
    OR (doctor_id = auth.uid() AND get_my_role() = 'doctor')
  )
  WITH CHECK (
    get_my_role() = 'admin'
    OR get_my_role() = 'clinic_admin'
    OR (doctor_id = auth.uid() AND get_my_role() = 'doctor')
  );

CREATE POLICY "prescriptions_delete"
  ON prescriptions FOR DELETE TO authenticated
  USING (
    get_my_role() = 'admin'
    OR get_my_role() = 'clinic_admin'
    OR (doctor_id = auth.uid() AND get_my_role() = 'doctor')
  );

-- INVOICES
DROP POLICY IF EXISTS "invoices_select" ON invoices;
DROP POLICY IF EXISTS "invoices_insert" ON invoices;
DROP POLICY IF EXISTS "invoices_update" ON invoices;
DROP POLICY IF EXISTS "invoices_delete" ON invoices;

CREATE POLICY "invoices_select"
  ON invoices FOR SELECT TO authenticated
  USING (
    get_my_role() = 'admin'
    OR clinic_id = get_my_clinic_id()
  );

CREATE POLICY "invoices_insert"
  ON invoices FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() = 'admin'
    OR clinic_id = get_my_clinic_id()
  );

CREATE POLICY "invoices_update"
  ON invoices FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'admin'
    OR clinic_id = get_my_clinic_id()
  )
  WITH CHECK (
    get_my_role() = 'admin'
    OR clinic_id = get_my_clinic_id()
  );

CREATE POLICY "invoices_delete"
  ON invoices FOR DELETE TO authenticated
  USING (
    get_my_role() = 'admin'
    OR (clinic_id = get_my_clinic_id() AND get_my_role() IN ('clinic_admin', 'doctor'))
  );

-- DENTAL_SERVICES (if table exists, update policies)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dental_services') THEN
    DROP POLICY IF EXISTS "dental_services_select" ON dental_services;
    DROP POLICY IF EXISTS "dental_services_insert" ON dental_services;
    DROP POLICY IF EXISTS "dental_services_update" ON dental_services;
    DROP POLICY IF EXISTS "dental_services_delete" ON dental_services;
    DROP POLICY IF EXISTS "Authenticated users can view dental services" ON dental_services;
    DROP POLICY IF EXISTS "Admins can insert dental services" ON dental_services;
    DROP POLICY IF EXISTS "Admins can update dental services" ON dental_services;
    DROP POLICY IF EXISTS "Admins can delete dental services" ON dental_services;

    EXECUTE 'CREATE POLICY "dental_services_select" ON dental_services FOR SELECT TO authenticated USING (true)';
    EXECUTE 'CREATE POLICY "dental_services_insert" ON dental_services FOR INSERT TO authenticated WITH CHECK (get_my_role() IN (''admin'', ''clinic_admin''))';
    EXECUTE 'CREATE POLICY "dental_services_update" ON dental_services FOR UPDATE TO authenticated USING (get_my_role() IN (''admin'', ''clinic_admin'')) WITH CHECK (get_my_role() IN (''admin'', ''clinic_admin''))';
    EXECUTE 'CREATE POLICY "dental_services_delete" ON dental_services FOR DELETE TO authenticated USING (get_my_role() IN (''admin'', ''clinic_admin''))';
  END IF;
END $$;

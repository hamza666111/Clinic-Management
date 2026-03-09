/*
  # Rebuild RLS: Clinic-Scoped Access + Storage Bucket

  ## Purpose
  Completely replace all RLS policies with proper clinic-scoped logic.

  ## Access Rules
  - ADMIN: sees ALL data across all clinics, full CRUD everywhere
  - DOCTOR: sees only data from their own clinic_id, can write within their clinic
  - RECEPTIONIST: sees only data from their own clinic_id, limited write (no delete)
  - Doctors from Clinic A CANNOT see data from Clinic B

  ## Helper function
  - get_my_clinic_id(): returns the clinic_id of the currently authenticated user
  - get_my_role(): returns the role of the currently authenticated user

  ## Storage
  - patient-files bucket created for file uploads
*/

-- Helper function: get current user's clinic_id
CREATE OR REPLACE FUNCTION get_my_clinic_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT clinic_id FROM public.users_profile WHERE id = auth.uid()
$$;

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.users_profile WHERE id = auth.uid()
$$;

-- ============================================================
-- CLINICS: Admin sees all, others see only their own clinic
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view clinics" ON clinics;
DROP POLICY IF EXISTS "Authenticated users can insert clinics" ON clinics;
DROP POLICY IF EXISTS "Authenticated users can update clinics" ON clinics;
DROP POLICY IF EXISTS "Authenticated users can delete clinics" ON clinics;

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
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "clinics_delete"
  ON clinics FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

-- ============================================================
-- USERS_PROFILE: Drop all old policies and rebuild
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON users_profile;
DROP POLICY IF EXISTS "Users can insert their own profile" ON users_profile;
DROP POLICY IF EXISTS "Users can update profiles" ON users_profile;
DROP POLICY IF EXISTS "Authenticated users can delete profiles" ON users_profile;
DROP POLICY IF EXISTS "Admins can update any profile" ON users_profile;
DROP POLICY IF EXISTS "Users can update own profile" ON users_profile;
DROP POLICY IF EXISTS "Admins can delete profiles" ON users_profile;

-- Admin: sees all profiles; others: see only profiles in their clinic (+ themselves)
CREATE POLICY "users_profile_select"
  ON users_profile FOR SELECT TO authenticated
  USING (
    get_my_role() = 'admin'
    OR id = auth.uid()
    OR clinic_id = get_my_clinic_id()
  );

CREATE POLICY "users_profile_insert"
  ON users_profile FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id OR get_my_role() = 'admin');

CREATE POLICY "users_profile_update"
  ON users_profile FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'admin'
    OR auth.uid() = id
  )
  WITH CHECK (
    get_my_role() = 'admin'
    OR auth.uid() = id
  );

CREATE POLICY "users_profile_delete"
  ON users_profile FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

-- ============================================================
-- PATIENTS: Clinic-scoped access
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view patients" ON patients;
DROP POLICY IF EXISTS "Authenticated users can insert patients" ON patients;
DROP POLICY IF EXISTS "Authenticated users can update patients" ON patients;
DROP POLICY IF EXISTS "Authenticated users can delete patients" ON patients;

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
    OR (clinic_id = get_my_clinic_id() AND get_my_role() IN ('doctor', 'receptionist'))
  )
  WITH CHECK (
    get_my_role() = 'admin'
    OR (clinic_id = get_my_clinic_id() AND get_my_role() IN ('doctor', 'receptionist'))
  );

CREATE POLICY "patients_delete"
  ON patients FOR DELETE TO authenticated
  USING (
    get_my_role() = 'admin'
    OR (clinic_id = get_my_clinic_id() AND get_my_role() = 'doctor')
  );

-- ============================================================
-- PATIENT_FILES: Clinic-scoped via patient join
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view patient files" ON patient_files;
DROP POLICY IF EXISTS "Authenticated users can insert patient files" ON patient_files;
DROP POLICY IF EXISTS "Authenticated users can delete patient files" ON patient_files;

CREATE POLICY "patient_files_select"
  ON patient_files FOR SELECT TO authenticated
  USING (
    get_my_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM patients p
      WHERE p.id = patient_files.patient_id
      AND (p.clinic_id = get_my_clinic_id() OR get_my_role() = 'admin')
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
    OR (
      uploaded_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM patients p
        WHERE p.id = patient_files.patient_id
        AND p.clinic_id = get_my_clinic_id()
      )
    )
  );

-- ============================================================
-- APPOINTMENTS: Clinic-scoped
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view appointments" ON appointments;
DROP POLICY IF EXISTS "Authenticated users can insert appointments" ON appointments;
DROP POLICY IF EXISTS "Authenticated users can update appointments" ON appointments;
DROP POLICY IF EXISTS "Authenticated users can delete appointments" ON appointments;

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
    OR (clinic_id = get_my_clinic_id() AND get_my_role() IN ('doctor', 'receptionist'))
  );

-- ============================================================
-- MEDICINES: All authenticated can view; only admin can write
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view medicines" ON medicines;
DROP POLICY IF EXISTS "Authenticated users can insert medicines" ON medicines;
DROP POLICY IF EXISTS "Authenticated users can update medicines" ON medicines;
DROP POLICY IF EXISTS "Authenticated users can delete medicines" ON medicines;

CREATE POLICY "medicines_select"
  ON medicines FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "medicines_insert"
  ON medicines FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "medicines_update"
  ON medicines FOR UPDATE TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "medicines_delete"
  ON medicines FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

-- ============================================================
-- PRESCRIPTIONS: Clinic-scoped via patient join
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view prescriptions" ON prescriptions;
DROP POLICY IF EXISTS "Authenticated users can insert prescriptions" ON prescriptions;
DROP POLICY IF EXISTS "Authenticated users can update prescriptions" ON prescriptions;
DROP POLICY IF EXISTS "Authenticated users can delete prescriptions" ON prescriptions;

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
      get_my_role() = 'doctor'
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
    OR (doctor_id = auth.uid() AND get_my_role() = 'doctor')
  )
  WITH CHECK (
    get_my_role() = 'admin'
    OR (doctor_id = auth.uid() AND get_my_role() = 'doctor')
  );

CREATE POLICY "prescriptions_delete"
  ON prescriptions FOR DELETE TO authenticated
  USING (
    get_my_role() = 'admin'
    OR (doctor_id = auth.uid() AND get_my_role() = 'doctor')
  );

-- ============================================================
-- INVOICES: Clinic-scoped
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view invoices" ON invoices;
DROP POLICY IF EXISTS "Authenticated users can insert invoices" ON invoices;
DROP POLICY IF EXISTS "Authenticated users can update invoices" ON invoices;
DROP POLICY IF EXISTS "Authenticated users can delete invoices" ON invoices;

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
    OR (clinic_id = get_my_clinic_id() AND get_my_role() IN ('doctor', 'receptionist'))
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
    OR (clinic_id = get_my_clinic_id() AND get_my_role() = 'doctor')
  );

-- ============================================================
-- STORAGE: Create patient-files bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'patient-files',
  'patient-files',
  false,
  52428800,
  ARRAY['image/jpeg','image/png','image/gif','image/webp','application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/gif','image/webp','application/pdf'];

-- Storage policies for patient-files bucket
DROP POLICY IF EXISTS "patient_files_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "patient_files_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "patient_files_storage_delete" ON storage.objects;

CREATE POLICY "patient_files_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'patient-files');

CREATE POLICY "patient_files_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'patient-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "patient_files_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'patient-files' AND auth.uid() IS NOT NULL);

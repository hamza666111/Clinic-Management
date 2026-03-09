/*
  # Remove clinic_admin role from all RLS policies
  
  1. Changes
    - Update all RLS policies that reference clinic_admin role
    - Replace clinic_admin permissions with either admin or doctor as appropriate
  
  2. Tables affected
    - dental_services
    - clinic_service_prices
    - clinics
    - patients
    - patient_files
    - medicines
    - prescriptions
    - invoices
*/

-- dental_services policies
DROP POLICY IF EXISTS "dental_services_insert" ON dental_services;
DROP POLICY IF EXISTS "dental_services_update" ON dental_services;
DROP POLICY IF EXISTS "dental_services_delete" ON dental_services;

CREATE POLICY "dental_services_insert"
  ON dental_services FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "dental_services_update"
  ON dental_services FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "dental_services_delete"
  ON dental_services FOR DELETE
  TO authenticated
  USING (get_my_role() = 'admin');

-- clinic_service_prices policies
DROP POLICY IF EXISTS "csp_insert" ON clinic_service_prices;
DROP POLICY IF EXISTS "csp_update" ON clinic_service_prices;
DROP POLICY IF EXISTS "csp_delete" ON clinic_service_prices;

CREATE POLICY "csp_insert"
  ON clinic_service_prices FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "csp_update"
  ON clinic_service_prices FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "csp_delete"
  ON clinic_service_prices FOR DELETE
  TO authenticated
  USING (get_my_role() = 'admin');

-- clinics policies
DROP POLICY IF EXISTS "clinics_update" ON clinics;

CREATE POLICY "clinics_update"
  ON clinics FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- patients policies
DROP POLICY IF EXISTS "patients_delete" ON patients;

CREATE POLICY "patients_delete"
  ON patients FOR DELETE
  TO authenticated
  USING (
    get_my_role() = 'admin'
    OR (clinic_id = get_my_clinic_id() AND get_my_role() = 'doctor')
  );

-- patient_files policies
DROP POLICY IF EXISTS "patient_files_delete" ON patient_files;

CREATE POLICY "patient_files_delete"
  ON patient_files FOR DELETE
  TO authenticated
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

-- medicines policies
DROP POLICY IF EXISTS "medicines_insert" ON medicines;
DROP POLICY IF EXISTS "medicines_update" ON medicines;
DROP POLICY IF EXISTS "medicines_delete" ON medicines;

CREATE POLICY "medicines_insert"
  ON medicines FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'doctor'));

CREATE POLICY "medicines_update"
  ON medicines FOR UPDATE
  TO authenticated
  USING (get_my_role() IN ('admin', 'doctor'))
  WITH CHECK (get_my_role() IN ('admin', 'doctor'));

CREATE POLICY "medicines_delete"
  ON medicines FOR DELETE
  TO authenticated
  USING (get_my_role() IN ('admin', 'doctor'));

-- prescriptions policies
DROP POLICY IF EXISTS "prescriptions_insert" ON prescriptions;
DROP POLICY IF EXISTS "prescriptions_update" ON prescriptions;
DROP POLICY IF EXISTS "prescriptions_delete" ON prescriptions;

CREATE POLICY "prescriptions_insert"
  ON prescriptions FOR INSERT
  TO authenticated
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
  ON prescriptions FOR UPDATE
  TO authenticated
  USING (
    get_my_role() = 'admin'
    OR (doctor_id = auth.uid() AND get_my_role() = 'doctor')
  )
  WITH CHECK (
    get_my_role() = 'admin'
    OR (doctor_id = auth.uid() AND get_my_role() = 'doctor')
  );

CREATE POLICY "prescriptions_delete"
  ON prescriptions FOR DELETE
  TO authenticated
  USING (
    get_my_role() = 'admin'
    OR (doctor_id = auth.uid() AND get_my_role() = 'doctor')
  );

-- invoices policies
DROP POLICY IF EXISTS "invoices_delete" ON invoices;

CREATE POLICY "invoices_delete"
  ON invoices FOR DELETE
  TO authenticated
  USING (
    get_my_role() = 'admin'
    OR (clinic_id = get_my_clinic_id() AND get_my_role() = 'doctor')
  );

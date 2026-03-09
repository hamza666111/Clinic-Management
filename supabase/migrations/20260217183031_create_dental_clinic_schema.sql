/*
  # Dental Clinic Management System - Complete Schema

  ## Overview
  This migration creates the full database schema for a dental clinic management system.

  ## New Tables

  ### users_profile
  - Extends Supabase auth.users with role and clinic assignment
  - Columns: id, name, email, role (admin/doctor/receptionist), clinic_id, avatar_url, is_active

  ### clinics
  - Clinic locations/branches
  - Columns: id, clinic_name, address, phone, email, created_at

  ### patients
  - Patient records with medical and dental history
  - Columns: id, name, age, gender, contact, email, address, medical_history, dental_history, notes, doctor_id, clinic_id, created_at

  ### patient_files
  - Uploaded files (images, PDFs) linked to patients
  - Columns: id, patient_id, file_url, file_type, file_name, uploaded_by, created_at

  ### appointments
  - Appointment scheduling
  - Columns: id, patient_id, doctor_id, clinic_id, appointment_date, appointment_time, status, notes, created_at

  ### medicines
  - Master medicine list
  - Columns: id, medicine_name, created_at

  ### prescriptions
  - Doctor prescriptions linked to patients
  - Columns: id, patient_id, doctor_id, treatments, medicines (jsonb), notes, created_at

  ### invoices
  - Billing/invoices
  - Columns: id, patient_id, clinic_id, doctor_id, items (jsonb), doctor_fee, total_amount, status, created_at

  ## Security
  - RLS enabled on all tables
  - Authenticated users can read all data (clinic staff)
  - Role-based write permissions enforced at application level
*/

-- CLINICS TABLE
CREATE TABLE IF NOT EXISTS clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_name text NOT NULL,
  address text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view clinics"
  ON clinics FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert clinics"
  ON clinics FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update clinics"
  ON clinics FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete clinics"
  ON clinics FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- USERS PROFILE TABLE
CREATE TABLE IF NOT EXISTS users_profile (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'receptionist' CHECK (role IN ('admin', 'doctor', 'receptionist')),
  clinic_id uuid REFERENCES clinics(id) ON DELETE SET NULL,
  avatar_url text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE users_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view profiles"
  ON users_profile FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON users_profile FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update profiles"
  ON users_profile FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete profiles"
  ON users_profile FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- PATIENTS TABLE
CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  age integer DEFAULT 0,
  gender text DEFAULT 'other' CHECK (gender IN ('male', 'female', 'other')),
  contact text DEFAULT '',
  email text DEFAULT '',
  address text DEFAULT '',
  medical_history text DEFAULT '',
  dental_history text DEFAULT '',
  notes text DEFAULT '',
  doctor_id uuid REFERENCES users_profile(id) ON DELETE SET NULL,
  clinic_id uuid REFERENCES clinics(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view patients"
  ON patients FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert patients"
  ON patients FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update patients"
  ON patients FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete patients"
  ON patients FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- PATIENT FILES TABLE
CREATE TABLE IF NOT EXISTS patient_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_type text DEFAULT 'other',
  file_name text DEFAULT '',
  uploaded_by uuid REFERENCES users_profile(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE patient_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view patient files"
  ON patient_files FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert patient files"
  ON patient_files FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete patient files"
  ON patient_files FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- APPOINTMENTS TABLE
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES users_profile(id) ON DELETE SET NULL,
  clinic_id uuid REFERENCES clinics(id) ON DELETE SET NULL,
  appointment_date date NOT NULL,
  appointment_time time DEFAULT '09:00:00',
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no-show')),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view appointments"
  ON appointments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert appointments"
  ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update appointments"
  ON appointments FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete appointments"
  ON appointments FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- MEDICINES TABLE
CREATE TABLE IF NOT EXISTS medicines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_name text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view medicines"
  ON medicines FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert medicines"
  ON medicines FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update medicines"
  ON medicines FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete medicines"
  ON medicines FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- PRESCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES users_profile(id) ON DELETE SET NULL,
  treatments text DEFAULT '',
  medicines jsonb DEFAULT '[]'::jsonb,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view prescriptions"
  ON prescriptions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert prescriptions"
  ON prescriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update prescriptions"
  ON prescriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete prescriptions"
  ON prescriptions FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- INVOICES TABLE
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES clinics(id) ON DELETE SET NULL,
  doctor_id uuid REFERENCES users_profile(id) ON DELETE SET NULL,
  items jsonb DEFAULT '[]'::jsonb,
  doctor_fee numeric DEFAULT 0,
  total_amount numeric DEFAULT 0,
  status text DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'partial', 'cancelled')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert invoices"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update invoices"
  ON invoices FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete invoices"
  ON invoices FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_patients_doctor_id ON patients(doctor_id);
CREATE INDEX IF NOT EXISTS idx_patients_clinic_id ON patients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_patient_id ON invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_files_patient_id ON patient_files(patient_id);

-- Function to auto-create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO users_profile (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'receptionist')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Seed default medicines
INSERT INTO medicines (medicine_name) VALUES
  ('Amoxicillin'),
  ('Metronidazole'),
  ('Ibuprofen'),
  ('Paracetamol'),
  ('Clindamycin'),
  ('Diclofenac'),
  ('Omeprazole'),
  ('Chlorhexidine Mouthwash'),
  ('Benzocaine Gel'),
  ('Lidocaine')
ON CONFLICT (medicine_name) DO NOTHING;

-- Seed a default clinic
INSERT INTO clinics (clinic_name, address, phone, email) VALUES
  ('PearlSmile Dental Clinic', '123 Healthcare Boulevard, Medical District', '+1 (555) 123-4567', 'info@pearlsmile.com')
ON CONFLICT DO NOTHING;

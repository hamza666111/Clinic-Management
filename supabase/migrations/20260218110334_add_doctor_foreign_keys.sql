/*
  # Add Doctor Foreign Keys

  1. Problem
    - Tables with doctor_id column lack foreign key to users_profile
    - Supabase PostgREST cannot resolve joins without FK relationships

  2. Changes
    - Add FK from patients.doctor_id to users_profile.id
    - Add FK from appointments.doctor_id to users_profile.id
    - Add FK from invoices.doctor_id to users_profile.id
    - Add FK from prescriptions.doctor_id to users_profile.id
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'patients_doctor_id_fkey' 
    AND table_name = 'patients'
  ) THEN
    ALTER TABLE patients 
    ADD CONSTRAINT patients_doctor_id_fkey 
    FOREIGN KEY (doctor_id) REFERENCES users_profile(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'appointments_doctor_id_fkey' 
    AND table_name = 'appointments'
  ) THEN
    ALTER TABLE appointments 
    ADD CONSTRAINT appointments_doctor_id_fkey 
    FOREIGN KEY (doctor_id) REFERENCES users_profile(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'invoices_doctor_id_fkey' 
    AND table_name = 'invoices'
  ) THEN
    ALTER TABLE invoices 
    ADD CONSTRAINT invoices_doctor_id_fkey 
    FOREIGN KEY (doctor_id) REFERENCES users_profile(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'prescriptions_doctor_id_fkey' 
    AND table_name = 'prescriptions'
  ) THEN
    ALTER TABLE prescriptions 
    ADD CONSTRAINT prescriptions_doctor_id_fkey 
    FOREIGN KEY (doctor_id) REFERENCES users_profile(id) ON DELETE SET NULL;
  END IF;
END $$;

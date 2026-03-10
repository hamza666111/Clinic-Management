/*
  # Add Created By Tracking For Activity Audit

  1. Changes
    - Add `created_by` to `appointments`, `prescriptions`, and `invoices`
    - Link `created_by` to `users_profile(id)` for readable staff attribution
    - Set column defaults to `auth.uid()` for automatic capture on authenticated inserts
    - Add indexes for admin activity lookups

  2. Notes
    - Existing records remain nullable when creator is unknown
    - Client code should still pass `created_by` explicitly for clarity
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE appointments ADD COLUMN created_by uuid NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'prescriptions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE prescriptions ADD COLUMN created_by uuid NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE invoices ADD COLUMN created_by uuid NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'appointments_created_by_fkey'
  ) THEN
    ALTER TABLE appointments
      ADD CONSTRAINT appointments_created_by_fkey
      FOREIGN KEY (created_by)
      REFERENCES users_profile(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'prescriptions_created_by_fkey'
  ) THEN
    ALTER TABLE prescriptions
      ADD CONSTRAINT prescriptions_created_by_fkey
      FOREIGN KEY (created_by)
      REFERENCES users_profile(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invoices_created_by_fkey'
  ) THEN
    ALTER TABLE invoices
      ADD CONSTRAINT invoices_created_by_fkey
      FOREIGN KEY (created_by)
      REFERENCES users_profile(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i'
      AND c.relname = 'idx_appointments_created_by'
      AND n.nspname = 'public'
  ) THEN
    CREATE INDEX idx_appointments_created_by ON appointments(created_by);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i'
      AND c.relname = 'idx_prescriptions_created_by'
      AND n.nspname = 'public'
  ) THEN
    CREATE INDEX idx_prescriptions_created_by ON prescriptions(created_by);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i'
      AND c.relname = 'idx_invoices_created_by'
      AND n.nspname = 'public'
  ) THEN
    CREATE INDEX idx_invoices_created_by ON invoices(created_by);
  END IF;
END $$;

ALTER TABLE appointments ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE prescriptions ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE invoices ALTER COLUMN created_by SET DEFAULT auth.uid();

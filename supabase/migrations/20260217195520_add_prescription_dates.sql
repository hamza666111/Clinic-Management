/*
  # Add start_date and end_date to prescriptions

  ## Purpose
  Track the active period of each prescription so staff can see
  which prescriptions are currently active, upcoming, or expired.

  ## Changes
  - `prescriptions` table
    - Added `start_date` (date, nullable) — when the prescription begins
    - Added `end_date` (date, nullable) — when the prescription ends/expires
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prescriptions' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE prescriptions ADD COLUMN start_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prescriptions' AND column_name = 'end_date'
  ) THEN
    ALTER TABLE prescriptions ADD COLUMN end_date date;
  END IF;
END $$;

/*
  # Add structured fields to medicines table

  ## Changes
  - Adds `medicine_type` column to `medicines` for categorization (Tablet, Capsule, Syrup, etc.)
  - Adds `strength` column to store default strength (e.g., 250mg, 500mg)

  ## Purpose
  These columns allow the medicines table to act as a reusable preset library.
  When a doctor fills out a prescription using the structured form, the medicine's
  type and strength are saved back so the same combination auto-populates next time.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'medicines' AND column_name = 'medicine_type'
  ) THEN
    ALTER TABLE medicines ADD COLUMN medicine_type text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'medicines' AND column_name = 'strength'
  ) THEN
    ALTER TABLE medicines ADD COLUMN strength text DEFAULT '';
  END IF;
END $$;

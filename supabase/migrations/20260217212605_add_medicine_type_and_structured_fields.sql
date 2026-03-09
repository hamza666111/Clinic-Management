/*
  # Add Medicine Type Classification and Structured Fields

  1. Changes to `medicines` table
    - Add `medicine_type` column (text) for classification (Tablet, Capsule, Syrup, etc.)
    - Add `strength` column (text) for dosage strength (e.g., 250mg, 500mg, 5ml)
    - Add `form` column (text, optional) for additional form notes
    - Add `default_dosage` column (text, optional) for default dosage instructions
    - Remove old unstructured fields if they exist
    
  2. Notes
    - Medicine names should be unique within a clinic
    - System will support auto-save of manually entered medicines
    - Dropdown will show: medicine_name (strength) - type
*/

-- Add new structured fields to medicines table
DO $$
BEGIN
  -- Add medicine_type column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'medicines' AND column_name = 'medicine_type'
  ) THEN
    ALTER TABLE medicines ADD COLUMN medicine_type text NOT NULL DEFAULT 'Tablet';
  END IF;

  -- Add strength column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'medicines' AND column_name = 'strength'
  ) THEN
    ALTER TABLE medicines ADD COLUMN strength text DEFAULT '';
  END IF;

  -- Add form column (optional notes)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'medicines' AND column_name = 'form'
  ) THEN
    ALTER TABLE medicines ADD COLUMN form text DEFAULT '';
  END IF;

  -- Add default_dosage column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'medicines' AND column_name = 'default_dosage'
  ) THEN
    ALTER TABLE medicines ADD COLUMN default_dosage text DEFAULT '';
  END IF;
END $$;

-- Create index for faster medicine lookups by type
CREATE INDEX IF NOT EXISTS idx_medicines_type ON medicines(medicine_type);

-- Create index for medicine name searches
CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(medicine_name);
/*
  # Add amount_paid column to invoices

  1. Changes
    - `invoices` table: add `amount_paid` (numeric, default 0) to track how much has been collected on partial invoices
  2. Notes
    - Existing rows default to 0
    - The left (balance) amount is computed as total_amount - amount_paid
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'amount_paid'
  ) THEN
    ALTER TABLE invoices ADD COLUMN amount_paid numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

/*
  # Add Discount Fields To Invoices

  1. Changes
    - Add `discount_type` (`amount` or `percentage`)
    - Add `discount_value` (raw input value)
    - Add `discount_amount` (resolved PKR amount)

  2. Notes
    - Existing invoices default to no discount
    - Total amount remains the final payable after discount
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'discount_type'
  ) THEN
    ALTER TABLE invoices ADD COLUMN discount_type text NOT NULL DEFAULT 'amount';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'discount_value'
  ) THEN
    ALTER TABLE invoices ADD COLUMN discount_value numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'discount_amount'
  ) THEN
    ALTER TABLE invoices ADD COLUMN discount_amount numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invoices_discount_type_check'
  ) THEN
    ALTER TABLE invoices
      ADD CONSTRAINT invoices_discount_type_check
      CHECK (discount_type IN ('amount', 'percentage'));
  END IF;
END $$;

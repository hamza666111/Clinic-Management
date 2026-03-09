/*
  # Create Global Medicine Types Catalog

  1. New Table
    - `medicine_types`
      - `id` (uuid, primary key)
      - `type_name` (text, unique)
      - `is_active` (boolean)
      - `created_by` (uuid, nullable)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Allow authenticated users to read active medicine types
    - Allow authenticated users to insert/update/delete medicine types

  3. Seed Data
    - Inserts default medicine type options used by dropdowns
*/

CREATE TABLE IF NOT EXISTS public.medicine_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_medicine_types_active_name
  ON public.medicine_types (is_active, type_name);

ALTER TABLE public.medicine_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "medicine_types_select" ON public.medicine_types;
DROP POLICY IF EXISTS "medicine_types_insert" ON public.medicine_types;
DROP POLICY IF EXISTS "medicine_types_update" ON public.medicine_types;
DROP POLICY IF EXISTS "medicine_types_delete" ON public.medicine_types;

CREATE POLICY "medicine_types_select"
  ON public.medicine_types
  FOR SELECT
  TO authenticated
  USING (is_active = true AND auth.uid() IS NOT NULL);

CREATE POLICY "medicine_types_insert"
  ON public.medicine_types
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "medicine_types_update"
  ON public.medicine_types
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "medicine_types_delete"
  ON public.medicine_types
  FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

INSERT INTO public.medicine_types (type_name)
VALUES
  ('Capsule'),
  ('Cream'),
  ('Drops'),
  ('Gel'),
  ('Injection'),
  ('Mouthwash'),
  ('Ointment'),
  ('Other'),
  ('Powder'),
  ('Spray'),
  ('Suspension'),
  ('Syrup'),
  ('Tablet')
ON CONFLICT (type_name) DO NOTHING;

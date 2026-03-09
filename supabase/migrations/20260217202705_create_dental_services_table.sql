/*
  # Create dental_services table

  ## Purpose
  A master list of dental services used across the entire application:
  prescriptions (treatment selection), POS billing (invoice items), and
  the public-facing services page.

  ## New Tables
  - `dental_services`
    - `id` (uuid, primary key)
    - `service_name` (text, not null) — display name of the service
    - `category` (text, not null) — one of the defined service categories
    - `default_price` (numeric, default 0) — editable default price shown in billing
    - `description` (text, default '') — optional details shown on public page
    - `is_active` (boolean, default true) — soft-delete / hide from UI
    - `sort_order` (int, default 0) — ordering within category
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Authenticated users can SELECT all active services (needed in forms across the app)
  - Only admins (checked via users_profile role) can INSERT / UPDATE / DELETE

  ## Seed Data
  All standard dental service categories and entries as specified.
*/

CREATE TABLE IF NOT EXISTS dental_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name text NOT NULL,
  category text NOT NULL DEFAULT '',
  default_price numeric(12,2) NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE dental_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active services"
  ON dental_services FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can insert services"
  ON dental_services FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users_profile
      WHERE users_profile.id = auth.uid() AND users_profile.role = 'admin'
    )
  );

CREATE POLICY "Admins can update services"
  ON dental_services FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users_profile
      WHERE users_profile.id = auth.uid() AND users_profile.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users_profile
      WHERE users_profile.id = auth.uid() AND users_profile.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete services"
  ON dental_services FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users_profile
      WHERE users_profile.id = auth.uid() AND users_profile.role = 'admin'
    )
  );

-- -------------------------------------------------------
-- Seed default services
-- -------------------------------------------------------

INSERT INTO dental_services (service_name, category, default_price, sort_order) VALUES
  -- General Treatments
  ('Consultation / Checkup', 'General Treatments', 500, 1),
  ('Oral Examination', 'General Treatments', 500, 2),
  ('Dental Cleaning (Scaling and Polishing)', 'General Treatments', 2500, 3),
  ('Deep Cleaning (Root Planing and Scaling)', 'General Treatments', 5000, 4),
  ('Fluoride Treatment', 'General Treatments', 1500, 5),
  ('Dental X-Ray', 'General Treatments', 1000, 6),
  ('Emergency Treatment', 'General Treatments', 3000, 7),

  -- Restorative Treatments
  ('Tooth Filling (Composite)', 'Restorative Treatments', 4000, 1),
  ('Tooth Filling (Amalgam)', 'Restorative Treatments', 2500, 2),
  ('Root Canal Treatment (RCT)', 'Restorative Treatments', 12000, 3),
  ('Re-Root Canal Treatment', 'Restorative Treatments', 15000, 4),
  ('Crown Placement', 'Restorative Treatments', 18000, 5),
  ('Bridge Placement', 'Restorative Treatments', 25000, 6),
  ('Core Build-Up', 'Restorative Treatments', 5000, 7),

  -- Cosmetic Treatments
  ('Teeth Whitening', 'Cosmetic Treatments', 15000, 1),
  ('Smile Design', 'Cosmetic Treatments', 50000, 2),
  ('Veneers', 'Cosmetic Treatments', 20000, 3),
  ('Composite Bonding', 'Cosmetic Treatments', 8000, 4),
  ('Cosmetic Contouring', 'Cosmetic Treatments', 5000, 5),
  ('Tooth Reshaping', 'Cosmetic Treatments', 4000, 6),

  -- Orthodontic Treatments
  ('Braces Consultation', 'Orthodontic Treatments', 1000, 1),
  ('Metal Braces', 'Orthodontic Treatments', 60000, 2),
  ('Ceramic Braces', 'Orthodontic Treatments', 80000, 3),
  ('Clear Aligners', 'Orthodontic Treatments', 120000, 4),
  ('Retainers', 'Orthodontic Treatments', 10000, 5),

  -- Oral Surgery
  ('Tooth Extraction', 'Oral Surgery', 2000, 1),
  ('Surgical Extraction', 'Oral Surgery', 5000, 2),
  ('Wisdom Tooth Removal', 'Oral Surgery', 8000, 3),
  ('Minor Oral Surgery', 'Oral Surgery', 10000, 4),
  ('Incision and Drainage', 'Oral Surgery', 3000, 5),

  -- Implant Procedures
  ('Implant Placement', 'Implant Procedures', 80000, 1),
  ('Implant Crown', 'Implant Procedures', 25000, 2),
  ('Bone Grafting', 'Implant Procedures', 30000, 3),
  ('Sinus Lift', 'Implant Procedures', 40000, 4),

  -- Prosthetic Treatments
  ('Complete Denture', 'Prosthetic Treatments', 30000, 1),
  ('Partial Denture', 'Prosthetic Treatments', 15000, 2),
  ('Denture Repair', 'Prosthetic Treatments', 3000, 3),
  ('Denture Relining', 'Prosthetic Treatments', 5000, 4),

  -- Children Treatments
  ('Child Consultation', 'Children Treatments', 500, 1),
  ('Child Cleaning', 'Children Treatments', 1500, 2),
  ('Space Maintainer', 'Children Treatments', 5000, 3),
  ('Fluoride Application', 'Children Treatments', 1000, 4),

  -- Gum Treatments
  ('Gum Therapy', 'Gum Treatments', 4000, 1),
  ('Periodontal Treatment', 'Gum Treatments', 8000, 2),
  ('Gum Surgery', 'Gum Treatments', 15000, 3),

  -- Root Canal Procedures
  ('Root Canal Therapy', 'Root Canal Procedures', 12000, 1),
  ('Pulp Capping', 'Root Canal Procedures', 3000, 2)
ON CONFLICT DO NOTHING;

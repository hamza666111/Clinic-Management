/*
  # Allow Doctors to Manage Medicines
  
  1. Changes
    - Update medicines_update policy to include doctors
    - Update medicines_delete policy to include doctors
  
  2. Security
    - Doctors can now add, edit, and delete medicines alongside admins and clinic_admins
*/

DROP POLICY IF EXISTS medicines_update ON medicines;
CREATE POLICY "medicines_update"
  ON medicines FOR UPDATE
  TO authenticated
  USING (get_my_role() IN ('admin', 'clinic_admin', 'doctor'))
  WITH CHECK (get_my_role() IN ('admin', 'clinic_admin', 'doctor'));

DROP POLICY IF EXISTS medicines_delete ON medicines;
CREATE POLICY "medicines_delete"
  ON medicines FOR DELETE
  TO authenticated
  USING (get_my_role() IN ('admin', 'clinic_admin', 'doctor'));
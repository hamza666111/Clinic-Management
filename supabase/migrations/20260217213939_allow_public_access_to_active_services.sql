/*
  # Allow Public Access to Active Dental Services

  1. Changes
    - Add RLS policy to allow anonymous (public) users to view active dental services
    - This enables the public website services page to display services without authentication
  
  2. Security
    - Only SELECT permission granted
    - Only active services (is_active = true) are accessible to public
    - Authenticated users retain their existing full access
*/

-- Drop the policy if it already exists, then create it
DO $$
BEGIN
  DROP POLICY IF EXISTS "Public can view active services" ON dental_services;
END $$;

-- Allow anonymous users to read active dental services
CREATE POLICY "Public can view active services"
  ON dental_services
  FOR SELECT
  TO anon
  USING (is_active = true);
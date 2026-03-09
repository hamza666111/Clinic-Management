/*
  # Make patient-files bucket public

  ## Purpose
  Allow direct URL access for images and PDFs so they can be viewed
  inline in the browser without needing signed URLs.

  ## Changes
  - Sets patient-files storage bucket to public
  - Authenticated users can still read/write (existing policies remain)
*/

UPDATE storage.buckets
SET public = true
WHERE id = 'patient-files';

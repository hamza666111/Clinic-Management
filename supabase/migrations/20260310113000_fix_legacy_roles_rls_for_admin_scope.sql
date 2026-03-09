/*
  Fix legacy clinic_roles RLS so global admin can manage roles/permissions
  across all clinics, while clinic_admin remains clinic-scoped.
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clinic_roles'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Clinic admins can manage roles" ON public.clinic_roles';

    EXECUTE '
      CREATE POLICY "Clinic admins can manage roles"
      ON public.clinic_roles FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.users_profile up
          WHERE up.id = auth.uid()
            AND (
              up.role = ''admin''
              OR (up.role = ''clinic_admin'' AND up.clinic_id = clinic_roles.clinic_id)
            )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.users_profile up
          WHERE up.id = auth.uid()
            AND (
              up.role = ''admin''
              OR (up.role = ''clinic_admin'' AND up.clinic_id = clinic_roles.clinic_id)
            )
        )
      )
    ';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'role_permissions'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'role_permissions' AND column_name = 'page_key'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Clinic admins can manage permissions" ON public.role_permissions';

    EXECUTE '
      CREATE POLICY "Clinic admins can manage permissions"
      ON public.role_permissions FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.clinic_roles cr
          JOIN public.users_profile up ON up.id = auth.uid()
          WHERE cr.id = role_permissions.role_id
            AND (
              up.role = ''admin''
              OR (up.role = ''clinic_admin'' AND up.clinic_id = cr.clinic_id)
            )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.clinic_roles cr
          JOIN public.users_profile up ON up.id = auth.uid()
          WHERE cr.id = role_permissions.role_id
            AND (
              up.role = ''admin''
              OR (up.role = ''clinic_admin'' AND up.clinic_id = cr.clinic_id)
            )
        )
      )
    ';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'role_settings'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Clinic admins can manage role settings" ON public.role_settings';

    EXECUTE '
      CREATE POLICY "Clinic admins can manage role settings"
      ON public.role_settings FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.clinic_roles cr
          JOIN public.users_profile up ON up.id = auth.uid()
          WHERE cr.id = role_settings.role_id
            AND (
              up.role = ''admin''
              OR (up.role = ''clinic_admin'' AND up.clinic_id = cr.clinic_id)
            )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.clinic_roles cr
          JOIN public.users_profile up ON up.id = auth.uid()
          WHERE cr.id = role_settings.role_id
            AND (
              up.role = ''admin''
              OR (up.role = ''clinic_admin'' AND up.clinic_id = cr.clinic_id)
            )
        )
      )
    ';
  END IF;
END $$;

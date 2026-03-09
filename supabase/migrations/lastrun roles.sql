begin;

grant usage on schema public to authenticated;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'clinic_roles'
  ) then
    execute 'alter table public.clinic_roles enable row level security';
    execute 'grant select, insert, update, delete on public.clinic_roles to authenticated';

    execute 'drop policy if exists "Users can view roles in their clinic" on public.clinic_roles';
    execute 'drop policy if exists "Clinic admins can manage roles" on public.clinic_roles';

    execute '
      create policy "Users can view roles in their clinic"
      on public.clinic_roles
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.users_profile up
          where up.id = auth.uid()
            and (
              up.role = ''admin''
              or up.clinic_id = clinic_roles.clinic_id
            )
        )
      )
    ';

    execute '
      create policy "Clinic admins can manage roles"
      on public.clinic_roles
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.users_profile up
          where up.id = auth.uid()
            and (
              up.role = ''admin''
              or (up.role = ''clinic_admin'' and up.clinic_id = clinic_roles.clinic_id)
            )
        )
      )
      with check (
        exists (
          select 1
          from public.users_profile up
          where up.id = auth.uid()
            and (
              up.role = ''admin''
              or (up.role = ''clinic_admin'' and up.clinic_id = clinic_roles.clinic_id)
            )
        )
      )
    ';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'role_permissions'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'role_permissions' and column_name = 'page_key'
  ) and exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'clinic_roles'
  ) then
    execute 'alter table public.role_permissions enable row level security';
    execute 'grant select, insert, update, delete on public.role_permissions to authenticated';

    execute 'drop policy if exists "Clinic admins can manage permissions" on public.role_permissions';

    execute '
      create policy "Clinic admins can manage permissions"
      on public.role_permissions
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.clinic_roles cr
          join public.users_profile up on up.id = auth.uid()
          where cr.id = role_permissions.role_id
            and (
              up.role = ''admin''
              or (up.role = ''clinic_admin'' and up.clinic_id = cr.clinic_id)
            )
        )
      )
      with check (
        exists (
          select 1
          from public.clinic_roles cr
          join public.users_profile up on up.id = auth.uid()
          where cr.id = role_permissions.role_id
            and (
              up.role = ''admin''
              or (up.role = ''clinic_admin'' and up.clinic_id = cr.clinic_id)
            )
        )
      )
    ';
  end if;
end $$;

commit;
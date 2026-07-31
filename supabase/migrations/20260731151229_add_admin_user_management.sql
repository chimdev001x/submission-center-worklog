create table public.submission_system_settings (
  singleton boolean primary key default true check (singleton),
  max_users integer not null default 10 check (max_users >= 1),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.submission_system_settings (singleton, max_users)
values (true, 10)
on conflict (singleton) do nothing;

alter table public.submission_system_settings enable row level security;
revoke all on table public.submission_system_settings from public, anon, authenticated;

create or replace function private.is_submission_admin(candidate uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.submission_profiles
    where id = candidate and level = 9
  );
$$;

revoke all on function private.is_submission_admin(uuid) from public, anon, authenticated;

create or replace function public.submission_registration_available()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*) from auth.users) < settings.max_users
  from public.submission_system_settings as settings
  where settings.singleton = true;
$$;

revoke all on function public.submission_registration_available() from public;
grant execute on function public.submission_registration_available() to anon, authenticated;

create or replace function private.enforce_submission_user_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed_users integer;
  current_users integer;
begin
  select max_users into allowed_users
  from public.submission_system_settings
  where singleton = true
  for update;

  select count(*) into current_users from auth.users;
  if current_users >= allowed_users then
    raise exception using
      errcode = 'P0001',
      message = 'SUBMISSION_USER_LIMIT_REACHED';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_submission_user_limit() from public, anon, authenticated;

create trigger enforce_submission_user_limit_before_insert
before insert on auth.users
for each row execute function private.enforce_submission_user_limit();

create or replace function public.submission_admin_overview()
returns table (user_count bigint, max_users integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_submission_admin((select auth.uid())) then
    raise exception using errcode = '42501', message = 'ADMIN_ACCESS_REQUIRED';
  end if;

  return query
  select (select count(*) from auth.users), settings.max_users
  from public.submission_system_settings as settings
  where settings.singleton = true;
end;
$$;

create or replace function public.submission_admin_list_users()
returns table (
  id uuid,
  email text,
  display_name text,
  level smallint,
  created_at timestamptz,
  confirmed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_submission_admin((select auth.uid())) then
    raise exception using errcode = '42501', message = 'ADMIN_ACCESS_REQUIRED';
  end if;

  return query
  select users.id, users.email::text, profiles.display_name, profiles.level,
    users.created_at, users.email_confirmed_at
  from auth.users as users
  join public.submission_profiles as profiles on profiles.id = users.id
  order by users.created_at asc;
end;
$$;

create or replace function public.submission_admin_set_user_limit(next_max_users integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_submission_admin((select auth.uid())) then
    raise exception using errcode = '42501', message = 'ADMIN_ACCESS_REQUIRED';
  end if;
  if next_max_users is null or next_max_users < 1 then
    raise exception using errcode = '22023', message = 'USER_LIMIT_MUST_BE_POSITIVE';
  end if;

  update public.submission_system_settings
  set max_users = next_max_users,
      updated_at = now(),
      updated_by = (select auth.uid())
  where singleton = true;
  return next_max_users;
end;
$$;

create or replace function public.submission_admin_delete_user(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_submission_admin((select auth.uid())) then
    raise exception using errcode = '42501', message = 'ADMIN_ACCESS_REQUIRED';
  end if;
  if target_user_id is null or target_user_id = (select auth.uid()) then
    raise exception using errcode = '22023', message = 'CANNOT_DELETE_CURRENT_ADMIN';
  end if;

  delete from auth.users where id = target_user_id;
  return found;
end;
$$;

revoke all on function public.submission_admin_overview() from public, anon;
revoke all on function public.submission_admin_list_users() from public, anon;
revoke all on function public.submission_admin_set_user_limit(integer) from public, anon;
revoke all on function public.submission_admin_delete_user(uuid) from public, anon;
grant execute on function public.submission_admin_overview() to authenticated;
grant execute on function public.submission_admin_list_users() to authenticated;
grant execute on function public.submission_admin_set_user_limit(integer) to authenticated;
grant execute on function public.submission_admin_delete_user(uuid) to authenticated;

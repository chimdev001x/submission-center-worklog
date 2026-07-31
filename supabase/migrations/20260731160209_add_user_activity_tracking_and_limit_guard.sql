alter table public.submission_profiles
  add column if not exists last_active_at timestamptz,
  add column if not exists total_usage_seconds bigint not null default 0;

create or replace function public.submission_record_activity()
returns table (last_active_at timestamptz, total_usage_seconds bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  current_time timestamptz := clock_timestamp();
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;

  return query
  update public.submission_profiles as profiles
  set total_usage_seconds = profiles.total_usage_seconds + case
        when profiles.last_active_at is not null
          and profiles.last_active_at >= current_time - interval '5 minutes'
        then least(90, greatest(0, floor(extract(epoch from (current_time - profiles.last_active_at)))::bigint))
        else 0
      end,
      last_active_at = current_time
  where profiles.id = caller_id
  returning profiles.last_active_at, profiles.total_usage_seconds;
end;
$$;

drop function if exists public.submission_admin_list_users();

create function public.submission_admin_list_users()
returns table (
  id uuid,
  email text,
  display_name text,
  level smallint,
  created_at timestamptz,
  confirmed_at timestamptz,
  last_active_at timestamptz,
  total_usage_seconds bigint
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
    users.created_at, users.email_confirmed_at, profiles.last_active_at,
    profiles.total_usage_seconds
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
declare
  current_user_count bigint;
begin
  if not private.is_submission_admin((select auth.uid())) then
    raise exception using errcode = '42501', message = 'ADMIN_ACCESS_REQUIRED';
  end if;

  select count(*) into current_user_count from auth.users;
  if next_max_users is null or next_max_users < current_user_count then
    raise exception using errcode = '22023', message = 'USER_LIMIT_BELOW_CURRENT_COUNT';
  end if;

  update public.submission_system_settings
  set max_users = next_max_users,
      updated_at = now(),
      updated_by = (select auth.uid())
  where singleton = true;
  return next_max_users;
end;
$$;

revoke all on function public.submission_record_activity() from public, anon;
revoke all on function public.submission_admin_list_users() from public, anon;
revoke all on function public.submission_admin_set_user_limit(integer) from public, anon;
grant execute on function public.submission_record_activity() to authenticated;
grant execute on function public.submission_admin_list_users() to authenticated;
grant execute on function public.submission_admin_set_user_limit(integer) to authenticated;

alter table public.submission_profiles
drop constraint submission_profiles_level_check;

alter table public.submission_profiles
add constraint submission_profiles_level_check check (level in (1, 2, 9));

alter table public.submission_profiles
add column theme jsonb not null default '{"mode":"auto","primary":"#667461","canvas":"#f6f1e7","surface":"#fffdf8","text":"#25251f","accent":"#b67847"}'::jsonb;

create policy "Users update own submission theme" on public.submission_profiles
for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

grant update (theme) on public.submission_profiles to authenticated;

create or replace function public.submission_admin_set_user_level(target_user_id uuid, next_level smallint)
returns smallint
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_submission_admin((select auth.uid())) then
    raise exception using errcode = '42501', message = 'ADMIN_ACCESS_REQUIRED';
  end if;
  if target_user_id is null or target_user_id = (select auth.uid()) then
    raise exception using errcode = '22023', message = 'CANNOT_CHANGE_CURRENT_ADMIN';
  end if;
  if next_level not in (1, 2, 9) then
    raise exception using errcode = '22023', message = 'INVALID_USER_LEVEL';
  end if;

  update public.submission_profiles set level = next_level where id = target_user_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'USER_NOT_FOUND';
  end if;
  return next_level;
end;
$$;

revoke all on function public.submission_admin_set_user_level(uuid, smallint) from public, anon;
grant execute on function public.submission_admin_set_user_level(uuid, smallint) to authenticated;

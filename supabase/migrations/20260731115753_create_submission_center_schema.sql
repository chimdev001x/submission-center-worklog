create schema if not exists private;

create table public.submission_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'User',
  level smallint not null default 1 check (level in (1, 9)),
  created_at timestamptz not null default now()
);

create table public.submission_months (
  user_id uuid not null references auth.users(id) on delete cascade,
  month_key text not null check (month_key ~ '^\d{4}-\d{2}$'),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, month_key)
);

create table public.submission_todos (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.submission_profiles enable row level security;
alter table public.submission_months enable row level security;
alter table public.submission_todos enable row level security;

create policy "Users read own submission profile" on public.submission_profiles
for select to authenticated using ((select auth.uid()) = id);

create policy "Users read own submission months" on public.submission_months
for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own submission months" on public.submission_months
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own submission months" on public.submission_months
for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Users read own submission todos" on public.submission_todos
for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own submission todos" on public.submission_todos
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own submission todos" on public.submission_todos
for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select on public.submission_profiles to authenticated;
grant select, insert, update on public.submission_months to authenticated;
grant select, insert, update on public.submission_todos to authenticated;

create or replace function private.handle_submission_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.submission_profiles (id, display_name, level)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, 'User'), '@', 1)),
    case when lower(coalesce(new.email, '')) = 'chimdev.001x@gmail.com' then 9 else 1 end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_submission_user() from public, anon, authenticated;

create trigger on_submission_auth_user_created
after insert on auth.users
for each row execute function private.handle_submission_user();

create table public.submission_theme_products (
  id text primary key,
  name text not null,
  description text not null default '',
  distribution_mode text not null default 'request' check (distribution_mode in ('request', 'paid')),
  price_satang integer not null default 0 check (price_satang >= 0),
  enabled boolean not null default true,
  preview_url text not null,
  theme_config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.submission_theme_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null references public.submission_theme_products(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  unique (user_id, product_id)
);

create table public.submission_theme_entitlements (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null references public.submission_theme_products(id) on delete cascade,
  source text not null check (source in ('admin', 'payment')),
  granted_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

alter table public.submission_theme_products enable row level security;
alter table public.submission_theme_requests enable row level security;
alter table public.submission_theme_entitlements enable row level security;

create policy "theme_products_read" on public.submission_theme_products for select to authenticated using (enabled or private.is_submission_admin((select auth.uid())));
create policy "theme_products_admin_update" on public.submission_theme_products for update to authenticated using (private.is_submission_admin((select auth.uid()))) with check (private.is_submission_admin((select auth.uid())));
create policy "theme_requests_read" on public.submission_theme_requests for select to authenticated using (user_id = (select auth.uid()) or private.is_submission_admin((select auth.uid())));
create policy "theme_requests_create" on public.submission_theme_requests for insert to authenticated with check (user_id = (select auth.uid()) and exists (select 1 from public.submission_profiles p where p.id = (select auth.uid()) and p.level >= 2));
create policy "theme_requests_retry" on public.submission_theme_requests for update to authenticated using (user_id = (select auth.uid()) and status = 'rejected') with check (user_id = (select auth.uid()) and status = 'pending');
create policy "theme_entitlements_read" on public.submission_theme_entitlements for select to authenticated using (user_id = (select auth.uid()) or private.is_submission_admin((select auth.uid())));

grant select on public.submission_theme_products to authenticated;
grant update (distribution_mode, price_satang, enabled, updated_at) on public.submission_theme_products to authenticated;
grant select, insert on public.submission_theme_requests to authenticated;
grant update (status) on public.submission_theme_requests to authenticated;
grant select on public.submission_theme_entitlements to authenticated;

insert into public.submission_theme_products (id, name, description, distribution_mode, price_satang, preview_url, theme_config)
values ('sanrio-line-atelier', 'Sanrio Line Atelier', 'ลายเส้นตัวละคร Sanrio บนสมุดบันทึกโทนครีม ชมพู และโกโก้', 'request', 9900, '/themes/sanrio-line-atelier.png', '{"primary":"#a7656c","canvas":"#fff9f1","surface":"#fffdf9","text":"#4b2d27","accent":"#d9858f"}'::jsonb)
on conflict (id) do nothing;

create or replace function public.submission_admin_review_theme_request(target_request_id uuid, next_status text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare request_row public.submission_theme_requests%rowtype;
begin
  if not private.is_submission_admin((select auth.uid())) then raise exception using errcode='42501', message='ADMIN_ACCESS_REQUIRED'; end if;
  if next_status not in ('approved','rejected') then raise exception using errcode='22023', message='INVALID_REQUEST_STATUS'; end if;
  update public.submission_theme_requests set status=next_status, reviewed_at=now(), reviewed_by=(select auth.uid()) where id=target_request_id returning * into request_row;
  if not found then return false; end if;
  if next_status='approved' then insert into public.submission_theme_entitlements(user_id,product_id,source) values(request_row.user_id,request_row.product_id,'admin') on conflict do nothing; end if;
  return true;
end; $$;

revoke all on function public.submission_admin_review_theme_request(uuid,text) from public, anon;
grant execute on function public.submission_admin_review_theme_request(uuid,text) to authenticated;

-- RLS policies are evaluated with the signed-in role. The original policies
-- called a private helper whose EXECUTE permission was intentionally revoked,
-- so every product SELECT failed before the UI could render the store.
create or replace function private.is_current_submission_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_submission_admin((select auth.uid()));
$$;

revoke all on function private.is_current_submission_admin() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_current_submission_admin() to authenticated;

drop policy if exists "theme_products_read" on public.submission_theme_products;
create policy "theme_products_read"
on public.submission_theme_products
for select to authenticated
using (enabled or (select private.is_current_submission_admin()));

drop policy if exists "theme_products_admin_update" on public.submission_theme_products;
create policy "theme_products_admin_update"
on public.submission_theme_products
for update to authenticated
using ((select private.is_current_submission_admin()))
with check ((select private.is_current_submission_admin()));

drop policy if exists "theme_requests_read" on public.submission_theme_requests;
create policy "theme_requests_read"
on public.submission_theme_requests
for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_current_submission_admin()));

drop policy if exists "theme_entitlements_read" on public.submission_theme_entitlements;
create policy "theme_entitlements_read"
on public.submission_theme_entitlements
for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_current_submission_admin()));

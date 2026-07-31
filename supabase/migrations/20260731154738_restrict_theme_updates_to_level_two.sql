drop policy if exists "submission_profiles_update_own" on public.submission_profiles;

create policy "submission_profiles_update_own"
on public.submission_profiles
for update
to authenticated
using (auth.uid() = id and level >= 2)
with check (auth.uid() = id and level >= 2);

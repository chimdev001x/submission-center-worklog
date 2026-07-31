create or replace function public.submission_record_activity()
returns table (last_active_at timestamptz, total_usage_seconds bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  activity_time timestamptz := clock_timestamp();
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;

  return query
  update public.submission_profiles as profiles
  set total_usage_seconds = profiles.total_usage_seconds + case
        when profiles.last_active_at is not null
          and profiles.last_active_at >= activity_time - interval '5 minutes'
        then least(90, greatest(0, floor(extract(epoch from (activity_time - profiles.last_active_at)))::bigint))
        else 0
      end,
      last_active_at = activity_time
  where profiles.id = caller_id
  returning profiles.last_active_at, profiles.total_usage_seconds;
end;
$$;

revoke all on function public.submission_record_activity() from public, anon;
grant execute on function public.submission_record_activity() to authenticated;

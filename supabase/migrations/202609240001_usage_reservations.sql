-- Durable Google Places budget reservations.  The fixture provider does not
-- call this function; the live provider must call it before any HTTP request.

create table public.places_usage_daily (
  usage_date date primary key,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

create trigger places_usage_daily_set_updated_at
before update on public.places_usage_daily
for each row execute function public.set_updated_at();

alter table public.places_usage_daily enable row level security;

create or replace function public.persist_new_lead(p_lead jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_place_id text := p_lead->>'placeId';
begin
  if v_place_id is null or btrim(v_place_id) = '' then
    raise exception 'A lead place ID is required.';
  end if;

  insert into public.place_registry (place_id) values (v_place_id)
  on conflict (place_id) do nothing;
  if not found then return false; end if;

  insert into public.leads (
    place_id, business_name, address, phone, website, rating, review_count,
    category, recipient_email, email_status
  ) values (
    v_place_id, p_lead->>'name', p_lead->>'address', p_lead->>'phone',
    p_lead->>'website', (p_lead->>'rating')::numeric,
    (p_lead->>'reviewCount')::integer, p_lead->>'category',
    p_lead->>'recipientEmail', coalesce(p_lead->>'emailStatus', 'not_sent')
  );
  return true;
end;
$$;

revoke all on function public.persist_new_lead(jsonb) from public;
grant execute on function public.persist_new_lead(jsonb) to service_role;

create or replace function public.reserve_places_usage(
  p_daily_limit integer,
  p_monthly_limit integer,
  p_now timestamptz default now()
)
returns table (
  reserved boolean,
  daily_requests integer,
  monthly_requests integer,
  daily_remaining integer,
  monthly_remaining integer,
  next_month_reset timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (p_now at time zone 'UTC')::date;
  v_month date := date_trunc('month', p_now at time zone 'UTC')::date;
  v_daily_count integer := 0;
  v_monthly_count integer := 0;
begin
  if p_daily_limit <= 0 or p_monthly_limit <= 0 then
    raise exception 'Usage limits must be positive.';
  end if;

  -- One short transaction-wide lock makes checking both counters and adding
  -- one reservation indivisible, including when their rows do not yet exist.
  perform pg_advisory_xact_lock(hashtext('simplicate_places_usage_reservation'));

  select request_count into v_daily_count
  from public.places_usage_daily where usage_date = v_day for update;
  v_daily_count := coalesce(v_daily_count, 0);

  select request_count into v_monthly_count
  from public.places_usage_monthly where month_start = v_month for update;
  v_monthly_count := coalesce(v_monthly_count, 0);

  if v_daily_count >= p_daily_limit or v_monthly_count >= p_monthly_limit then
    return query select false, v_daily_count, v_monthly_count,
      greatest(p_daily_limit - v_daily_count, 0),
      greatest(p_monthly_limit - v_monthly_count, 0),
      ((v_month + interval '1 month')::timestamp at time zone 'UTC');
    return;
  end if;

  insert into public.places_usage_daily (usage_date, request_count)
  values (v_day, v_daily_count + 1)
  on conflict (usage_date) do update set request_count = excluded.request_count;

  insert into public.places_usage_monthly (month_start, request_count)
  values (v_month, v_monthly_count + 1)
  on conflict (month_start) do update set request_count = excluded.request_count;

  return query select true, v_daily_count + 1, v_monthly_count + 1,
    p_daily_limit - v_daily_count - 1,
    p_monthly_limit - v_monthly_count - 1,
    ((v_month + interval '1 month')::timestamp at time zone 'UTC');
end;
$$;

revoke all on function public.reserve_places_usage(integer, integer, timestamptz) from public;
grant execute on function public.reserve_places_usage(integer, integer, timestamptz) to service_role;

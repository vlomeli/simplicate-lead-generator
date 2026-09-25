-- Sprint One database foundation.
--
-- This migration intentionally does not grant browser clients direct access to
-- leads, exports, usage records, or deduplication history. The protected
-- Express API will own those operations using its server-only service key.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.place_registry (
  place_id text primary key,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  place_id text not null references public.place_registry (place_id) on delete restrict,
  business_name text not null,
  address text,
  phone text,
  website text,
  rating numeric(2, 1),
  review_count integer,
  category text,
  recipient_email text,
  email_status text not null default 'not_sent'
    check (email_status in ('not_sent', 'sent', 'do_not_contact')),
  discovered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (place_id)
);

create table public.lead_searches (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid references auth.users (id) on delete set null,
  query text not null,
  location text not null,
  max_results integer not null check (max_results between 1 and 50),
  provider_requests integer not null default 0 check (provider_requests >= 0),
  status text not null check (status in ('succeeded', 'failed', 'blocked')),
  failure_code text,
  created_at timestamptz not null default now()
);

create table public.lead_exports (
  id uuid primary key default gen_random_uuid(),
  generated_by uuid references auth.users (id) on delete set null,
  filename text not null,
  lead_count integer not null check (lead_count >= 0),
  created_at timestamptz not null default now()
);

create table public.places_usage_monthly (
  month_start date primary key,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  check (month_start = date_trunc('month', month_start)::date)
);

create index leads_discovered_at_idx on public.leads (discovered_at desc);
create index lead_searches_created_at_idx on public.lead_searches (created_at desc);
create index lead_searches_requested_by_idx on public.lead_searches (requested_by);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger leads_set_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

create trigger places_usage_monthly_set_updated_at
before update on public.places_usage_monthly
for each row execute function public.set_updated_at();

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create trigger create_profile_after_auth_user
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

alter table public.profiles enable row level security;
alter table public.place_registry enable row level security;
alter table public.leads enable row level security;
alter table public.lead_searches enable row level security;
alter table public.lead_exports enable row level security;
alter table public.places_usage_monthly enable row level security;

create policy "users can read their own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

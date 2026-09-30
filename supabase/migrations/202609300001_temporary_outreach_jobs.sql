-- Temporary outreach-list data. Permanent duplicate prevention stays in
-- place_registry; detailed results expire after a short review/download window.

create table public.outreach_jobs (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references auth.users (id) on delete cascade,
  query text not null,
  location text not null,
  target_count integer not null check (target_count between 1 and 50),
  source text not null check (source in ('fixture', 'google_places')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed', 'stopped')),
  businesses_found integer not null default 0 check (businesses_found >= 0),
  websites_checked integer not null default 0 check (websites_checked >= 0),
  emails_found integer not null default 0 check (emails_found >= 0),
  failure_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days')
);

create table public.outreach_job_results (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.outreach_jobs (id) on delete cascade,
  place_id text not null,
  business_name text not null,
  address text,
  phone text,
  website text,
  rating numeric(2, 1),
  review_count integer,
  category text,
  recipient_email text,
  email_source_url text,
  email_status text not null
    check (email_status in ('found', 'not_found', 'no_website', 'skipped', 'failed')),
  email_checked_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  unique (job_id, place_id)
);

create index outreach_jobs_requested_by_created_at_idx
  on public.outreach_jobs (requested_by, created_at desc);
create index outreach_jobs_expires_at_idx on public.outreach_jobs (expires_at);
create index outreach_job_results_job_id_idx on public.outreach_job_results (job_id);

alter table public.outreach_jobs enable row level security;
alter table public.outreach_job_results enable row level security;

-- Claiming only the ID keeps duplicate prevention durable without retaining
-- full lead details for every future outreach list.
create or replace function public.claim_place_id(p_place_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_place_id is null or btrim(p_place_id) = '' then
    raise exception 'A place ID is required.';
  end if;

  insert into public.place_registry (place_id) values (p_place_id)
  on conflict (place_id) do nothing;
  return found;
end;
$$;

revoke all on function public.claim_place_id(text) from public;
grant execute on function public.claim_place_id(text) to service_role;
grant select, insert, update, delete on table public.outreach_jobs to service_role;
grant select, insert, update, delete on table public.outreach_job_results to service_role;

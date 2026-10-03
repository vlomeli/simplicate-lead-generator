-- These temporary job counters explain how a list was filled without adding
-- any permanent business details beyond the existing place registry IDs.

alter table public.outreach_jobs
  add column include_nearby boolean not null default false,
  add column primary_businesses_found integer not null default 0 check (primary_businesses_found >= 0),
  add column nearby_businesses_found integer not null default 0 check (nearby_businesses_found >= 0);

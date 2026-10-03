# Architecture

## Components

```text
React dashboard
      |
      | Supabase Auth session + HTTPS requests
      v
Express API
  |          |             |
  |          |             +-- Public business websites (optional email checks)
  |          +-- Google Places (optional live searches)
  +-- Supabase Auth and Postgres
```

| Component | Responsibility |
| --- | --- |
| React dashboard | Sign-in, password change/recovery, list creation, progress, recent lists, and CSV downloads. |
| Express API | Authentication verification, request validation, safety limits, job coordination, CSV responses, and external requests. |
| Supabase Auth | User identity, sessions, invite acceptance, and password recovery. |
| Supabase Postgres | Permanent duplicate IDs, temporary jobs/results, and Google request counters. |
| Google Places | Business search data only. It does not provide business email addresses. |
| Public websites | Optional source of visibly published business email addresses. |

## Outreach-list flow

```text
Signed-in user
  → create outreach job
  → validate and rate-limit request
  → reserve Google allowance when live
  → search fixtures or Google Places
  → claim each new Place ID permanently
  → check public website pages when enabled
  → save temporary results and progress
  → download outreach or full-list CSV
```

For a 50-business list, Google search can paginate through up to three result
pages. Nearby fill can add up to three more requests. Website discovery is
bounded to three pages per business and runs three checks at a time.

## Data ownership and retention

| Data | Lifetime |
| --- | --- |
| Google Place ID | Permanent, for duplicate prevention only. |
| Outreach job and business/email result details | Seven days. |
| Google daily/monthly request counters | Durable until their time-window changes. |
| Supabase Auth account | Managed by Supabase Auth. |
| CSV download | Generated from the temporary job data; not stored as durable application files. |

## Safety boundaries

- The browser never receives the Google key or Supabase secret/service-role key.
- Live Google is disabled unless `GOOGLE_PLACES_ENABLED=true`.
- Website checks are disabled unless `WEBSITE_EMAIL_DISCOVERY_ENABLED=true`.
- Per-user request limits and daily/monthly Google reservations run before live requests.
- Website discovery never submits forms, guesses email addresses, bypasses blocks, or executes browser JavaScript.
- `403` websites and JavaScript-rendered-only emails can remain unavailable.

# Supabase database setup

This directory holds the database schema for the private application. It is
source-controlled so a future developer can review the schema and reproduce it
without clicking through undocumented dashboard settings.

## Applying the first migration

1. In the Supabase project dashboard, open **SQL Editor**.
2. Create a new query.
3. Paste and run `migrations/202609230001_initial_private_leads.sql`, then
   `migrations/202609240001_usage_reservations.sql`, in that order.
4. Confirm each query completes successfully. Do not paste any API keys or
   database passwords into the repository or chat.

The migration is safe to apply once to the new project. It enables Row Level
Security on every application table. The browser has no direct access to lead,
deduplication, export, or usage records; a later protected backend endpoint
will use the server-only Supabase service key for those operations.

## Tables

| Table | Purpose |
| --- | --- |
| `profiles` | Minimal profile record for an authenticated user. |
| `place_registry` | Permanent `place_id` history for duplicate prevention. |
| `leads` | Normalized lead records available for review and CSV export. |
| `lead_searches` | Audit trail of requested searches and provider outcomes. |
| `lead_exports` | Metadata for generated CSV files; the CSV bytes are not stored here. |
| `places_usage_monthly` | The durable monthly request counter used by the application safety limit. |
| `places_usage_daily` | The durable daily request counter used by the application safety limit. |

`reserve_places_usage` is a server-only SQL function that atomically checks
and increments both counters. A future live Google provider must call it before
making an outbound request; fixture searches intentionally do not consume it.

## Security approach

- Supabase Auth owns credentials and password resets; application tables never
  store passwords.
- Row Level Security is enabled on every table.
- `profiles` lets a signed-in user read only their own profile.
- All lead and usage writes remain backend-only until a future migration adds
  narrowly scoped policies. The Supabase service-role key will only exist in
  the backend deployment environment.

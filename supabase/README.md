# Supabase database setup

For Supabase project creation, Auth configuration, and environment values, see
[the Supabase setup guide](../docs/supabase-setup.md).

Run these migrations once, in filename order, from the Supabase SQL Editor:

1. `migrations/202609230001_initial_private_leads.sql`
2. `migrations/202609240001_usage_reservations.sql`
3. `migrations/202609300001_temporary_outreach_jobs.sql`
4. `migrations/202610020001_outreach_nearby_counts.sql`

Do not paste API keys or database passwords into the SQL Editor, repository, or chat. Each migration is additive and must be applied only once.

## Active outreach-list storage

| Table | Retention and purpose |
| --- | --- |
| `profiles` | One minimal profile for each Supabase Auth user. |
| `place_registry` | Permanent Google Place IDs only, used for duplicate prevention. |
| `places_usage_daily` | Current-day Google request count for the application safety limit. |
| `places_usage_monthly` | Current-month Google request count for the application safety limit. |
| `outreach_jobs` | Temporary list request, progress, source, and nearby-fill counts. |
| `outreach_job_results` | Temporary business and email-check results for each list. |

The backend removes expired outreach jobs and their results after seven days by default. `claim_place_id` permanently records only the ID. It does not retain a business's full details or public-email result after the job expires.

`reserve_places_usage` atomically checks and increments the daily and monthly application limits before each live Google request. Fixture mode does not use this function or consume Google allowance.

## Legacy foundation tables

The first migration also created `leads`, `lead_searches`, and `lead_exports` for the earlier direct-search prototype. The current dashboard uses `outreach_jobs` and `outreach_job_results` instead. Leave the older tables in place unless a separately planned migration removes them; deleting them manually can break historical code or migration assumptions.

## Security model

- Supabase Auth owns credentials, invite acceptance, and password recovery. Application tables never store passwords.
- Row Level Security is enabled on all application tables.
- The browser can read only its own profile directly.
- Lead data, duplicate claims, usage reservations, and export data are handled by the authenticated backend using the server-only service-role key.

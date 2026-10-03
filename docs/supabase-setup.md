# Supabase setup

This guide configures Supabase for local development. It does not deploy the
backend or frontend.

## 1. Create a project

Create a Supabase project, then record these values from its API settings:

| Value | Where it belongs | Exposure |
| --- | --- | --- |
| Project URL | `backend/.env` and `frontend/.env` | Browser-safe. |
| Publishable key | `frontend/.env` | Browser-safe. |
| Secret/service-role key | `backend/.env` only | Never expose or commit. |

Use the names in the provided environment templates:

```env
# backend/.env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_secret_key

# frontend/.env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
VITE_API_URL=http://localhost:5000
```

Do not put Google keys, Supabase secret keys, database passwords, or complete
`.env` contents in Git, screenshots, or chat.

## 2. Configure Auth for local development

In Supabase Auth settings, set the application Site URL to the local dashboard:

```text
http://localhost:5173
```

Add the same URL to the allowed redirect URLs so password recovery and invite
flows return to the dashboard. Add the production dashboard URL later, before
inviting users to the hosted app.

Use Supabase Auth for user creation, invites, password recovery, and password
changes. The application database never stores passwords.

## 3. Apply the database migrations

Open the Supabase SQL Editor. Run these files once, in filename order:

1. `supabase/migrations/202609230001_initial_private_leads.sql`
2. `supabase/migrations/202609240001_usage_reservations.sql`
3. `supabase/migrations/202609300001_temporary_outreach_jobs.sql`
4. `supabase/migrations/202610020001_outreach_nearby_counts.sql`

Confirm each query succeeds before running the next. Do not rerun an already
applied migration. See [the database reference](../supabase/README.md) for
what each table stores.

## 4. Start and verify locally

1. Start the backend from `backend/` with `npm run dev`.
2. Start the dashboard from `frontend/` with `npm run dev`.
3. Sign in with a valid Supabase Auth user.
4. Confirm the dashboard loads its usage card and can display fixture lists.

The browser uses the publishable key only. All Supabase writes for jobs,
results, duplicate claims, and usage counters happen through the authenticated
backend and its server-only key.

## Data retention

- `place_registry` permanently keeps only Google Place IDs to prevent repeats.
- Outreach jobs and their detailed results are deleted after seven days.
- Supabase Auth retains the user account and manages credentials.

No full business-list history is intended to be permanent.

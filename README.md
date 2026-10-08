# Simplicate Lead Generator

A private outreach tool for Simplicate. Signed-in teammates search for businesses, find publicly listed emails on their websites, review the results, and download CSVs for a separate email workflow. It does not send email.

## Contents

- [What it does](#what-it-does)
- [Architecture and data](#architecture-and-data)
- [Local setup](#local-setup)
- [Search and email logic](#search-and-email-logic)
- [Private beta deployment](#private-beta-deployment)
- [API and project layout](#api-and-project-layout)

## What it does

1. A Supabase Auth user chooses a business type, starting city, and target of up to 50 businesses, then confirms the search.
2. The backend searches fixtures or Google Places, skips Place IDs already collected, and checks public business websites for emails when enabled.
3. The dashboard shows progress, recent lists, usage limits, and a read-only map of starting cities searched since coverage tracking began.
4. The **full CSV** includes every saved business and its email-check outcome. The **outreach CSV** includes only businesses with a found public email. Both are downloaded for review; no outreach is sent by this app.

Fifty is a target, not a guarantee. A search can return fewer new businesses or fewer emails.

## Architecture and data

```text
React/Vite dashboard → Express API → Supabase Auth and Postgres
                                 → Google Places (optional)
                                 → public business websites (optional)
```

The browser uses a Supabase publishable key and sends its Auth token to the API. The API verifies the user, applies per-user and Google-request limits, and holds the Supabase secret key and Google key. Neither secret belongs in the frontend.

| Stored data | Retention |
| --- | --- |
| Google Place IDs in `place_registry` | Permanent, to prevent repeats. |
| Search centers and aggregate area counts | Permanent, to move repeated searches to fresh areas; no business details. |
| Outreach jobs, business details, and email outcomes | Seven days by default, then removed by the backend. |
| Auth accounts | Managed by Supabase Auth. |

CSV files are generated from temporary job data, not kept as durable application files. The older `leads`, `lead_searches`, and `lead_exports` tables belong to an earlier direct-search prototype; leave them in place unless a planned migration removes them. The current dashboard uses `outreach_jobs` and `outreach_job_results`.

## Local setup

You need Node.js/npm and a Supabase project. Google Places is optional until you deliberately enable live mode. Never commit `.env` files or share keys in screenshots or chat.

### 1. Set up Supabase

Create a project and copy its Project URL, browser **publishable key**, and server-only **secret/service-role key**. In Supabase Auth URL Configuration, set `http://localhost:5173` as the Site URL and an allowed redirect URL. Add the hosted frontend URL later if deploying. Invite users through Supabase Auth; an invite opens the password-setup screen before the dashboard. Password recovery remains available from sign-in.

Run the following SQL files **once, in order**, in the Supabase SQL Editor. Existing installations should run only migrations they have not already applied:

1. [`202609230001_initial_private_leads.sql`](supabase/migrations/202609230001_initial_private_leads.sql)
2. [`202609240001_usage_reservations.sql`](supabase/migrations/202609240001_usage_reservations.sql)
3. [`202609300001_temporary_outreach_jobs.sql`](supabase/migrations/202609300001_temporary_outreach_jobs.sql)
4. [`202610020001_outreach_nearby_counts.sql`](supabase/migrations/202610020001_outreach_nearby_counts.sql)
5. [`202610070001_search_coverage.sql`](supabase/migrations/202610070001_search_coverage.sql)

Row Level Security is enabled on application tables. The browser reads its own profile; the authenticated backend handles jobs, duplicate claims, coverage, usage reservations, and CSV data with the server-only key.

### 2. Configure local environment

Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env`. Set these values:

| File | Required values |
| --- | --- |
| `backend/.env` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CORS_ORIGIN=http://localhost:5173` |
| `frontend/.env` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_API_URL=http://localhost:5000` |

Start safely with both backend switches off:

```env
GOOGLE_PLACES_ENABLED=false
WEBSITE_EMAIL_DISCOVERY_ENABLED=false
```

Fixture mode makes **no Google or business-website requests**. Fixtures use fixed IDs, so after their first use a repeated fixture list may correctly show zero new businesses. Restart the backend after changing its `.env`.

### 3. Add Google Places only for live searches

In a dedicated Google Cloud project, attach billing, enable the Places API used by this backend, and create an API key restricted to that API. Keep it only in `backend/.env` or the backend host's secret settings as `GOOGLE_PLACES_API_KEY`. Apply the strongest application restriction your host supports. Review current pricing and quotas before enabling it; the app cannot guarantee a free bill.

Set a Google Cloud billing budget with alerts at 50%, 80%, and 90% of the monthly amount you are willing to spend, and use the lowest practical Places quota. These are secondary safeguards to the backend's limits. For a controlled live email test, set both backend switches to `true` and restart the backend. You can enable Google while leaving website checks off if testing search coverage alone.

The dashboard usage card shows **requests used / limit**, not requests available. The app's daily counter resets at midnight UTC: **5:00 PM in California during daylight saving time** and **4:00 PM during standard time**. The monthly counter resets on the first day of each month at midnight UTC. Opening the dashboard only reads these counters; it does not call Google Places.

### 4. Run and verify

Use two terminals:

```bash
cd backend
npm install
npm run dev
```

```bash
cd frontend
npm install
npm run dev
```

Open the local dashboard, sign in, and check the usage card and mode indicator before building a list. From `backend/`, run `npm test`; from `frontend/`, run `npm run build`. These are local checks, not live Google searches. For a live test, confirm remaining daily/monthly allowance first, then inspect both CSVs and the Google Cloud usage dashboard afterward.

To diagnose one public webpage without Google or Supabase writes, run `npm run diagnose:website -- https://example.com/contact/` from `backend/`. That command **does** fetch the specified website once.

## Search and email logic

- **Google budget:** Each live list uses at most six Places Text Search requests. The backend reserves daily/monthly allowance before every Google call. The per-user limiter permits five list starts per minute. A deliberate plan for three 50-business lists per day is `GOOGLE_PLACES_DAILY_REQUEST_LIMIT=18`, `GOOGLE_PLACES_MONTHLY_REQUEST_LIMIT=900`, and `GOOGLE_PLACES_REQUESTS_PER_MINUTE=5`. Start lower while testing. These are application safety stops, not Google billing caps.
- **Finding new businesses:** Google returns at most 20 candidates per Text Search request. The first search for a business type and starting location makes a broad request to establish a center, then samples fresh 5 km areas. Repeating the same search advances to unused areas. If city samples are sparse and **Expand to region** is checked, remaining requests may search the matching US state. The target of 50 may still be missed; this is not an exhaustive city or state directory.
- **Preventing duplicates:** New Place IDs are claimed in the permanent registry. Searches skip IDs already claimed, including those from older lists. Business details are not retained permanently.
- **Finding emails:** For each business website, the backend fetches no more than three likely pages, checking visible HTML text and `mailto:` links. For 50 businesses that means at most 150 website-page fetches, with three businesses checked concurrently. Website fetches do not consume Google Places requests. The checker does not guess addresses, submit forms, bypass `403` responses, or render JavaScript-only pages, so some valid emails will be missed. Review addresses before sending outreach.
- **Reading coverage:** The city map uses saved coordinates and no map provider calls. It shows tracked live starting cities; older searches without coordinates cannot be plotted. The smaller area diagram is for the selected business type and location. Its counts cover sampled areas across lists, **not** the initial broad lookup or the full list total.

## Private beta deployment

The intended small beta is a Vercel frontend, Render Node API, and Supabase Auth/Postgres. Provider free plans and limits can change; verify them in the provider dashboards before relying on them.

1. Run local tests/build and apply outstanding SQL migrations before deployment. Create a Render web service with root directory `backend`, build command `npm ci`, and start command `npm start`. Set `NODE_ENV=production`, the backend Supabase values, Google key and safety limits, and both feature flags to `false` in Render's environment settings. Do not upload a backend `.env` file. `GET https://your-api-host/api/health` should return `{"status":"ok"}`.
2. Create a Vercel project with root directory `frontend`. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_API_URL=https://your-api-host` as build-time variables.
3. Set Render's `CORS_ORIGIN` to the **exact** Vercel origin. If local development must continue, use a comma-separated value such as `http://localhost:5173,https://your-vercel-project-url`. Add the Vercel URL to Supabase Auth's Site URL and redirect allowlist; keep the local redirect too. Redeploy services when their environment values change.
4. Verify sign-in, invites/password recovery, fixture list building, recent lists, and both CSV downloads **before** enabling Google. Then deliberately enable `GOOGLE_PLACES_ENABLED=true` and, if wanted, `WEBSITE_EMAIL_DISCOVERY_ENABLED=true` on Render. Begin with one controlled live list and compare its app usage card with Google Cloud usage and billing alerts.

To stop new external requests, set both flags back to `false` and restart/redeploy the backend. When Simplicate supplies its own Google project and billing, replace the backend key there; no frontend code change is needed.

## API and project layout

All application endpoints except health require a Supabase Auth Bearer token.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Health check. |
| `GET /api/leads/usage` | Daily/monthly Google allowance. |
| `POST /api/outreach/jobs` | Start a list. |
| `GET /api/outreach/jobs` and `GET /api/outreach/jobs/:jobId` | Recent lists, progress, and results. |
| `GET /api/outreach/jobs/:jobId/export?type=full\|outreach` | Download a CSV. |
| `GET /api/outreach/coverage/cities` and `GET /api/outreach/coverage?query=...&location=...` | Read city and sampled-area coverage. |

`backend/src/` contains routes, controllers, services, middleware, and developer scripts; `frontend/` is the React dashboard; `supabase/migrations/` is the database history. The current list path is `outreachRoutes → outreachController → outreachJobService → provider/email services and outreachRepository`. `backend/data/exports/` is ignored local storage from the older direct-search workflow, not current list storage.

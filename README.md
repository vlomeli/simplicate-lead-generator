# Simplicate Lead Generator

Simplicate helps a signed-in user build an outreach list of businesses, find publicly displayed business emails when available, and download CSVs ready for review or an email workflow.

## What it does

1. Searches fixture data or Google Places for a business type and location.
2. Skips Google Place IDs that have already been collected.
3. Optionally checks each business website for a public email address.
4. Creates a temporary list that can be reopened for seven days.
5. Provides two downloads: an outreach-list CSV for businesses with a found email, and a full-list CSV with every email-check outcome.

Only the Google Place ID registry is permanent. Business details, email outcomes, and CSV-ready list data expire after seven days.

## Documentation

| Guide | Use it for |
| --- | --- |
| [Supabase setup](docs/supabase-setup.md) | Project creation, Auth URLs, environment values, and migrations. |
| [Google Places setup](docs/google-places-setup.md) | Billing, backend API key, restrictions, alerts, and live-mode safeguards. |
| [Architecture](docs/architecture.md) | Component boundaries, data retention, and request flow. |
| [Deployment guide](docs/deployment.md) | Private beta deployment with a Vercel frontend and Render backend. |
| [Database reference](supabase/README.md) | Active and legacy tables, retention, and SQL migration order. |

## Local setup

Apply the four SQL migrations in order before using authenticated list building. See [supabase/README.md](supabase/README.md).

Start the backend:

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Start the dashboard in another terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Set the Supabase values in both `.env` files. `SUPABASE_SERVICE_ROLE_KEY` is backend-only. Never put it or a Google API key in `frontend/.env`. Restart the backend after changing a backend `.env` value.

## Fixture mode and live mode

Both external integrations are off by default:

```env
GOOGLE_PLACES_ENABLED=false
WEBSITE_EMAIL_DISCOVERY_ENABLED=false
```

With both values false, list building uses fixtures only. It makes no Google Places request and does not fetch business websites.

Set `GOOGLE_PLACES_ENABLED=true` only when intentionally running a live Google test. Set `WEBSITE_EMAIL_DISCOVERY_ENABLED=true` only when intentionally allowing public website checks. These switches are independent: Google can be live while website email checks remain off.

The dashboard shows whether Google is disabled and displays the current daily and monthly application allowance.

## Recommended development budget: three 50-business lists per day

A Google Places Text Search page supplies at most 20 businesses. A request for 50 businesses can therefore use up to three Google requests. **Fifty is a target, not a guarantee:** Google can return fewer results when a query has limited matches or does not provide another results page. When **Include nearby areas if needed** is enabled, the application can use up to three more requests to fill the list from nearby areas.

| Activity | Maximum Google Places requests |
| --- | ---: |
| One 50-business list, exact location only | 3 |
| One 50-business list, including nearby fill | 6 |
| Three lists in one day, including nearby fill | 18 |
| Three such lists per day for 30 days | 540 |

For that deliberate development plan, use:

```env
GOOGLE_PLACES_DAILY_REQUEST_LIMIT=18
GOOGLE_PLACES_MONTHLY_REQUEST_LIMIT=900
GOOGLE_PLACES_REQUESTS_PER_MINUTE=5
```

The daily and monthly limits are application safety stops, not a replacement for Google Cloud billing controls or quotas. Confirm the active Google pricing, quota, API-key restrictions, and billing alerts before allowing production traffic. A smaller limit is safer while testing.

Duplicate prevention and a small city may yield fewer results than requested. A state can be entered as the location, but Google still returns relevance-ranked results rather than an exhaustive statewide directory. Nearby fill is opt-in and performs one additional search around the starting location; it does not automatically search every city in a state. The full address already records the business's city.

## Public website email discovery

For each business with a website, the backend checks no more than three pages: the Google-provided landing page plus up to two likely contact pages. It gives priority to a contact link exposed on the landing page, then tries standard `/contact/` and `/contact-us/` routes when space remains.

It looks for visibly published email text and `mailto:` links. It does not guess addresses, submit forms, bypass `403` blocks, or run a browser engine. As a result, it can miss emails that appear in a browser only after JavaScript renders the page. This is an intentional resource and safety trade-off.

At most 150 website-page fetches are made for a 50-business list. Checks run three at a time, so they do not make Google Places requests but may take longer than fixture mode and can be rejected by individual websites.

To inspect one page without Google or Supabase writes:

```bash
cd backend
npm run diagnose:website -- https://example.com/contact/
```

The diagnostic makes one website request and reports whether the raw HTML contains a supported public email.

## API overview

All application endpoints except health require a Supabase Auth Bearer token.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Backend health check. |
| `GET /api/leads/usage` | Current daily and monthly Google application allowance. |
| `POST /api/outreach/jobs` | Start an outreach-list job. |
| `GET /api/outreach/jobs` | List recent unexpired jobs. |
| `GET /api/outreach/jobs/:jobId` | Read job progress and results. |
| `GET /api/outreach/jobs/:jobId/export` | Download either CSV export. |

## Project layout

```text
backend/
  src/
    controllers/  HTTP request and response handling
    middleware/   Authentication and per-user request limits
    routes/       API paths
    services/     Google, Supabase, CSV, job, and website-check workflows
    scripts/      Developer diagnostics
  test/           Offline tests and fixtures
frontend/         React dashboard
supabase/         SQL migrations and schema notes
```

## Development notes

- Keep real credentials in ignored `.env` files only.
- Test backend changes from `backend/` with `npm test`.
- Build the dashboard from `frontend/` with `npm run build`.
- Keep HTTP concerns in controllers, workflow logic in services, and environment parsing in `backend/src/config/env.js`.

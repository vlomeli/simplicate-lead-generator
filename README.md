# Simplicate Lead Generator

## Current checkpoint — offline backend core complete

**Google Places is disabled.** The current search endpoint uses local fixture
data only, so development work makes **zero Google Places API requests** and
cannot create Google Places charges. Do not connect or call the Google service
without the project owner’s explicit approval.

The completed offline flow is:

```text
validated search request → local fixtures → normalize → in-memory deduplication → CSV export
```

`POST /api/leads/search` accepts `query`, `location`, and `maxResults` (a whole
number from 1 to 50). It returns only new fixture leads and writes a CSV to
`backend/data/exports/`. Duplicate prevention lasts until the backend restarts.

## Next approved implementation phase

Build the Supabase-backed backend layer: authenticated API access, permanent
duplicate registry, lead/search/export persistence, and atomic daily/monthly
usage reservations. This phase remains Google-free. The Google integration is
not the next automatic step; it requires a separate explicit approval.

## Documentation map

| File | Use it for |
| --- | --- |
| This README | Project status, safety rule, and primary entry point. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Component boundaries, data ownership, and non-negotiable safeguards. |
| [SPRINT_ONE.md](SPRINT_ONE.md) | Product scope and definition of done. |
| [STEPS.md](STEPS.md) | Ordered implementation checklist and handoff notes. |
| [supabase/README.md](supabase/README.md) | Database schema purpose and safe migration instructions. |
| [backend/src/README.md](backend/src/README.md) | Backend folder responsibilities. |

## Project summary

This project is a business lead-generation tool designed to help automate the process of finding potential business clients for a review-management service.

The goal is to reduce the manual work of researching businesses individually by using the Google Places API to discover relevant businesses, organize their information, and eventually use that data to create personalized outreach.

**Current focus:** Build authenticated persistence and usage protection without enabling live Google calls.

## Stage 1 — Google Places Lead Discovery

### Goal

Build a Node.js/Express API that searches the Google Places API using user-defined criteria and returns structured business data that can be used for lead generation.

### Requirements

The API should:

- Accept search criteria such as business type/category, location, and maximum number of results.
- Limit each search to 50 businesses for the initial release.
- Query the Google Places API.
- Normalize the API response into a consistent business object.
- Collect relevant fields:
  - `placeId`
  - `name`
  - `address`
  - `phone`
  - `website`
  - `rating`
  - `reviewCount`
  - `category`
- Use `placeId` to identify duplicate businesses.
- Maintain a temporary list of previously collected `placeId` values.
- Export newly discovered businesses to a CSV file.
- Track Places API requests for the current calendar month and return the remaining allowance to the signed-in user.
- Refuse a search before it would exceed the application's monthly safety limit. When the limit is reached, explain that searches resume after the monthly reset or that the project owner must deliberately upgrade the plan.

### Example request

```http
POST /api/leads/search
Content-Type: application/json
```

```json
{
  "query": "auto repair",
  "location": "Modesto, CA",
  "maxResults": 20
}
```

### Expected flow

```text
Search criteria
      ↓
Google Places API
      ↓
Normalize results
      ↓
Check placeId
      ↓
Remove duplicates
      ↓
Export new leads → CSV
```

### Stage 1 success criteria

Given a search such as **Auto repair businesses in Modesto, CA**, the API should return and export a clean list of new businesses while ignoring businesses that have already been collected.

Nothing beyond lead discovery and CSV generation is part of Stage 1.

## Google Places cost guardrails

Google Places is request-based, not token-based. A search that returns up to 50
businesses is normally one Text Search request, so 50 businesses per day is
approximately 30 requests and 1,500 businesses in a 30-day month. Pagination
or separate Place Details calls count as additional requests.

The fields needed for this project—phone, website, rating, and review count—
currently place a Text Search request in the Places API Text Search Enterprise
SKU. Google currently lists a free usage cap of 1,000 Enterprise Text Search
requests per month. This pricing can change, so the project owner must confirm
the current cap before enabling production traffic.

The application must use a lower, configurable monthly safety limit (initial
default: 900 requests), leaving a 100-request buffer. Before any request leaves
the server, the API must atomically reserve one request from this budget. The
dashboard must show the configured allowance, requests used, requests
remaining, and the next reset date. When the safety limit is reached, the
server must not call Google Places and must show a clear "wait for reset or
upgrade" message.

Google Cloud budgets and alerts are useful warnings, but they do not reliably
block future charges. Configure alerts at 50%, 80%, and 90% as a backup, use a
dedicated Google Cloud project for this application, and restrict the API key
to the Places API and the production server. Google Cloud quotas are a second
backstop; the server-side monthly budget is the primary hard stop.

References:

- [Google Maps Platform pricing](https://developers.google.com/maps/billing-and-pricing/pricing)
- [Places API usage limits and quotas](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing)
- [Google Cloud budgets](https://cloud.google.com/billing/docs/how-to/budgets)

## Repository layout

```text
backend/
  src/
    config/       Environment configuration
    controllers/  Request and response handling
    routes/       API endpoint definitions
    services/     Google Places, deduplication, and CSV workflow
    utils/        Small reusable transformation helpers
  data/exports/   Generated CSV files (not committed)
  test/           Offline automated tests
ARCHITECTURE.md   Component boundaries, data ownership, and safety model
SPRINT_ONE.md     Product scope and implementation guardrails
```

## Getting started

```bash
cd backend
npm install
cp .env.example .env
npm test
npm run dev
```

In Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

The starter server runs on `http://localhost:5000`. Use `GET /api/health` to confirm it is running. The lead-search route is scaffolded at `POST /api/leads/search`; its Google Places and CSV implementation is the next Stage 1 task.

## Development conventions

- Copy environment settings from `backend/.env.example`; never commit
  `backend/.env` or a real API key.
- Keep HTTP handling in controllers, workflows in services, and deterministic
  transformations in utilities.
- Add or update offline tests for a behavior before connecting it to Google.
- Run `npm test` from `backend/` before committing a backend change.
- Read [ARCHITECTURE.md](ARCHITECTURE.md) before changing a component boundary
  or safety limit.

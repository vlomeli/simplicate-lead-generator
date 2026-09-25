# Architecture

## Current checkpoint — fixture-only backend

The HTTP endpoint, validation, normalization, in-memory duplicate handling,
CSV generation, and offline tests are complete. The endpoint uses local fixture
data. It does not call Google or Supabase. The next phase adds protected
Supabase persistence and usage reservations; it must also remain Google-free.

## Purpose

Simplicate Lead Generator is a private lead-discovery tool. It accepts a small
business search, safely retrieves Google Places results, prevents duplicate
leads, and exports reviewed results to CSV. Sending outreach email is outside
the application for Sprint One.

## Planned components

```text
Private React dashboard
        |
        | authenticated HTTPS requests
        v
Node.js / Express API
        |                \
        |                 \ Google Places API
        v
Supabase Auth + Postgres
```

| Component | Responsibility | Does not do |
| --- | --- | --- |
| Dashboard | Sign-in, search form, usage display, result review, CSV download | Store the Google API key |
| Express API | Validate requests, enforce limits, call Google, coordinate business rules | Render dashboard pages |
| Supabase Auth | Email/password login and password reset | Make Google Places calls |
| Postgres | Users, permanent `placeId` deduplication, leads, exports, usage records | Store the Google API key |
| Google Places | Return place-search data | Provide business email addresses |

## Backend boundaries

```text
route -> controller -> lead service -> provider/export services
                                      -> utilities
```

- **Routes** define URLs and HTTP methods.
- **Controllers** validate HTTP-shaped input and format HTTP-shaped output.
- **Services** contain workflows and integrations.
- **Utilities** are small deterministic transformations such as normalization
  and duplicate comparison.
- **Config** is the only module that reads environment variables.

No controller should call Google directly. No browser code should receive a
Google Places API key.

## Safety model

The application—not a Google budget alert—is the primary cost safeguard.

1. Authenticate the caller.
2. Validate the search request and enforce `maxResults <= 50`.
3. Atomically reserve the request from the configured daily and monthly limits.
4. Call Google only after the reservation succeeds.
5. Save the outcome and return the remaining allowance and reset date.

Initial configuration defaults are deliberately conservative:

| Setting | Default | Purpose |
| --- | ---: | --- |
| `GOOGLE_PLACES_MONTHLY_REQUEST_LIMIT` | 900 | Leaves buffer below the current published 1,000-request free cap. |
| `GOOGLE_PLACES_DAILY_REQUEST_LIMIT` | 5 | Limits test-day usage while the Google trial quota cannot be lowered. |
| `GOOGLE_PLACES_REQUESTS_PER_MINUTE` | 5 | Prevents accidental bursts. |
| `MAX_SEARCH_RESULTS` | 50 | Keeps each search intentionally small. |

Google Cloud budget alerts remain a secondary warning. During the current free
trial, Google does not allow the daily Places quota to be lowered, so the
application limits are mandatory before live search is enabled.

## Data ownership and retention

- `placeId` is retained for permanent duplicate prevention.
- Google-derived data is displayed and handled in accordance with Google Places
  policies; it is not treated as a permanent bulk Google dataset.
- Publicly listed business contact emails, if later added, are manually
  reviewed. The Places API itself does not supply email addresses.
- Secrets exist only in deployment settings and local `.env` files.

## Development workflow

1. Copy `backend/.env.example` to `backend/.env`.
2. Run `npm install` and `npm test` in `backend/`.
3. Run `npm run dev` and check `GET /api/health`.
4. Develop with fixtures and tests first. A real Places request is a deliberate,
   separately tested integration step.

## Status by component

| Component | Status |
| --- | --- |
| Express API and input validation | Complete for offline development. |
| Fixtures, normalization, in-memory deduplication, CSV export | Complete and tested. |
| Supabase schema | Initial schema imported; apply the usage-reservations migration before using the backend. |
| Supabase Auth | API token verification is complete; frontend sign-in remains pending. |
| Durable usage limits | Atomic reservation RPC is implemented; do not enable Google until it is integration-tested. |
| Live Google Places integration | Intentionally disabled; requires explicit owner approval. |
| React dashboard | Pending. |

# Simplicate Lead Generator — Stage 1 Build Guide

> **Scope note:** This guide remains useful for the local API learning path.
> The current product plan is [SPRINT_ONE.md](SPRINT_ONE.md), and
> [ARCHITECTURE.md](ARCHITECTURE.md) is the source of truth for the private
> dashboard, Supabase persistence, authentication, and cost safeguards. Where
> this guide conflicts with those documents, follow the Sprint One plan.

Use this document as the project checklist. Complete the steps in order. Do not skip ahead when a step says **stop** or **verify**.

## The non-negotiable cost rule

All local development, testing, CSV work, and GitHub use in this guide can be done for free.

**Live Google Places data is not guaranteed to be completely free.** Google requires a billing-enabled project for Places API requests. Google currently provides per-SKU free usage caps, but usage above those caps can cost money. A budget alert is only an alert; it does not stop charges. Keep all live API work disabled until you deliberately choose to enable it, and use local mock data for every earlier step.

## How to use this guide

- A **deliverable** is the thing you should have when the step is complete.
- A **verify** instruction is the check you must perform before continuing.
- If you get stuck, share the step number and the exact error message. Do not share API keys, `.env` contents, or passwords.
- Work on a feature branch once the project has more than one contributor. Until then, keep commits small and descriptive on `main`.

---

## Milestone 0 — Run the starter project

### Step 0.1 — Confirm your project root

Open the `simplicate-lead-generator` folder in VS Code. It must contain `README.md`, `STEPS.md`, `backend/`, and `frontend/`.

**Verify:** Git Source Control shows this as the repository root, not `backend/`.

### Step 0.2 — Install backend dependencies

In a terminal, enter `backend/` and install the dependencies listed in `package.json`.

**Deliverable:** A local `backend/node_modules/` folder exists. It remains gray/ignored in VS Code and is never committed.

### Step 0.3 — Create your local environment file

Copy `backend/.env.example` to `backend/.env`. Leave the Google API key placeholder unchanged for now. Set a different `PORT` only if port `5000` is already in use.

**Verify:** `.env` is gray/ignored in VS Code. If it appears in Source Control, stop and fix `.gitignore` before continuing.

### Step 0.4 — Start and check the API

Start the backend in development mode. Call `GET /api/health` in a browser, Postman, Thunder Client, or another HTTP client.

**Expected result:** HTTP `200` with a JSON response whose `status` is `ok`.

**Stop if:** The server will not start, the port is unavailable, or the health route does not return `200`.

---

## Milestone 1 — Decide the data contract before writing logic

### Step 1.1 — Write the lead object contract

Before calling any external API, decide the exact JavaScript object your application will use for every lead. It must include the Stage 1 fields from `README.md`: `placeId`, `name`, `address`, `phone`, `website`, `rating`, `reviewCount`, and `category`.

For each field, document:

- Its expected type.
- Whether it is required or may be `null`.
- What value you use when Google does not provide it.

**Deliverable:** A short contract comment or documentation section that every later step follows.

### Step 1.2 — Define the search request rules

Decide the rules for `POST /api/leads/search`:

- `query` must be a non-empty string.
- `location` must be a non-empty string.
- `maxResults` must be a positive whole number.
- Choose and document a maximum allowed `maxResults` value to prevent accidental large searches.

**Deliverable:** A list of valid and invalid example requests.

### Step 1.3 — Define the CSV contract

Choose the CSV column order. Use the same field names and order every time. Decide how commas, quotes, line breaks, and missing values will be represented.

**Deliverable:** One documented header row and one example lead row.

### Step 1.4 — Define duplicate behavior

For Stage 1, `placeId` is the only duplicate key. Decide when the temporary set of collected IDs resets:

- Every server restart, or
- Only when the developer explicitly restarts the process.

Do not add a database in Stage 1.

**Deliverable:** One sentence documenting the reset behavior.

---

## Milestone 2 — Build and prove the workflow with no external API

### Step 2.1 — Add local fixture data

Create a small local fixture containing representative raw business results. Include at least:

- One complete business.
- One business missing phone and website.
- Two results with the same `placeId`.
- One name or address containing a comma or quote.

Do not use real keys or live API calls for this step.

**Deliverable:** Reusable fixture data that lets you develop the full workflow for free.

### Step 2.2 — Implement request validation

In the lead controller, validate the request rules from Step 1.2 before calling any service.

**Verify:** Each invalid request returns a clear HTTP `400` response that identifies the invalid field. A valid request proceeds to the service layer.

### Step 2.3 — Implement normalization

Implement the normalizer in `backend/src/utils/leadNormalizer.js`. It must convert every fixture result to the exact lead object defined in Step 1.1.

**Verify:** Missing optional values follow your documented rule. The normalizer does not return provider-specific property names.

### Step 2.4 — Implement duplicate removal

Implement deduplication in `backend/src/utils/deduplicateLeads.js` using `placeId`. Keep the temporary collected IDs in memory, as required by Stage 1.

**Verify:** The first request returns a lead. A second request containing the same `placeId` does not return or export it again. Restarting the server follows the reset rule from Step 1.4.

### Step 2.5 — Implement CSV export

Implement CSV creation in `backend/src/services/csvExportService.js`. Write generated files into `backend/data/exports/`.

**Verify:**

- The file has one header row.
- The columns follow Step 1.3.
- Values with commas or quotes remain valid CSV values.
- Generated CSV files remain untracked by Git.

### Step 2.6 — Connect the local workflow

Implement `leadService.js` so it coordinates fixture retrieval, normalization, duplicate removal, and CSV export. Then connect the controller to that service.

**Verify:** A valid `POST /api/leads/search` returns a clear JSON result containing newly found leads and export information. The scaffolded `501` response is no longer returned.

### Step 2.7 — Test the complete local path

Run these cases manually before using Google:

1. Valid search request.
2. Missing `query`.
3. Invalid `maxResults`.
4. Fixture result with missing optional fields.
5. Duplicate request.
6. CSV data containing commas or quotes.

**Deliverable:** A written checklist with the expected status code and result for each case.

---

## Milestone 3 — Decide whether to enable live Google Places

### Step 3.1 — Make an explicit cost decision

Choose one path:

- **Free-only path:** Keep using fixture data. The project remains completely free, but it does not retrieve live Google Places results.
- **Live-data path:** Enable Google Places only after you understand and accept Google’s billing requirements and current free usage caps.

Do not enable live Google Places accidentally. The free-only path is the correct choice while learning the backend workflow.

### Step 3.2 — Set up the live API safely (live-data path only)

In Google Cloud:

1. Create a dedicated project for this application.
2. Attach billing, which Google requires for Places API requests.
3. Enable only the Places API product you intend to use.
4. Create an API key.
5. Restrict the key to the Places API and to your backend’s allowed server environment.
6. Store the key only in `backend/.env` as `GOOGLE_PLACES_API_KEY`.
7. Set the lowest practical API quota limits and configure billing and quota alerts.

**Verify:** The key does not appear in Git, GitHub, screenshots, commits, or chat messages.

**Important:** Budget alerts do not hard-stop billing. Quota limits are the control intended to limit API usage.

### Step 3.3 — Minimize live API data and requests (live-data path only)

Choose the Google Places search method that matches your search requirements. Request only the fields required by the Stage 1 lead contract. Do not request fields “just in case.”

**Verify:** One controlled, low-result test search succeeds and the exact request count is known.

### Step 3.4 — Replace only the fixture source

Implement the Google request inside `googlePlacesService.js`. Keep all other layers unchanged:

```text
controller → lead service → Google Places service → normalizer → deduplication → CSV export
```

**Verify:** The live response is normalized into the same lead object as the fixture data. The controller must not need to know Google’s response shape.

---

## Milestone 4 — Make the API dependable

### Step 4.1 — Handle expected failures

Add clear responses for:

- Missing or invalid request fields.
- Missing Google API key.
- Google API timeout or error response.
- Google API quota or authentication failure.
- CSV write failure.

**Verify:** The server returns useful client-safe error messages and does not expose the API key, stack traces, or private configuration.

### Step 4.2 — Add automated tests

Start with unit tests for normalization, deduplication, request validation, and CSV formatting. Use fixture data; tests must not call Google.

**Deliverable:** Tests that can run without an API key or internet connection.

### Step 4.3 — Document the completed endpoint

Update `README.md` with:

- The final request body rules.
- A successful response example.
- Error response examples.
- Where CSV files are written.
- The exact commands to install, configure, run, and test the backend.

**Verify:** A new developer can start the local fixture version without asking for a Google key.

---

## Milestone 5 — Commit and review your work

### Step 5.1 — Review before every commit

From the project root, inspect the files that will be committed. Confirm `.env`, `node_modules`, and generated CSV files are absent.

**Stop if:** A secret, dependency folder, or generated CSV appears in the staged list.

### Step 5.2 — Make small commits

Commit one completed responsibility at a time. Examples: request validation, lead normalization, deduplication, CSV export, or tests. Avoid one large “everything” commit.

### Step 5.3 — Push only after local checks pass

Before pushing, run the API and its tests locally. Push only when `git status` is clean after the commit.

---

## Stage 1 definition of done

Stage 1 is complete only when all of these are true:

- `POST /api/leads/search` validates input.
- The search source returns business results (fixture-only or approved live Google Places).
- Every result is normalized to the agreed lead object.
- Previously collected `placeId` values are skipped for the documented temporary lifetime.
- Only new leads are written to a valid CSV file.
- Errors are clear and do not reveal secrets.
- Tests cover the core local workflow.
- `.env`, `node_modules`, and generated CSV files are not committed.

Do not add outreach, a database, authentication, or frontend features until this list is complete.

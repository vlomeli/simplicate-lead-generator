# Private beta deployment

This guide deploys the current application as a small private beta:

```text
Vercel frontend → Render Express API → Supabase Auth/Postgres
                                      → Google Places when enabled
```

Use the providers' free offerings only if their current dashboard shows that
they meet your needs. Provider plans and limits change. This guide does not
require adding a paid service or putting secrets in the repository.

## 1. Prepare the repository

Before deploying, the backend must have the `CORS_ORIGIN` configuration from
this repository version. The deployed API only accepts browser requests from
the exact origins listed in that setting.

Run backend tests and the frontend build locally before pushing a deployment
commit:

```bash
cd backend
npm test

cd ../frontend
npm run build
```

## 2. Create the backend service

Create a Node/Express web service from this Git repository on Render. Set its
root directory to `backend`, install dependencies with `npm ci`, and start it
with `npm start`.

Add these server-side environment values in the host dashboard. Do not create
or upload a backend `.env` file.

```env
NODE_ENV=production
CORS_ORIGIN=https://your-vercel-project-url
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_secret_key
GOOGLE_PLACES_API_KEY=your_backend_only_google_key
GOOGLE_PLACES_ENABLED=false
WEBSITE_EMAIL_DISCOVERY_ENABLED=false
GOOGLE_PLACES_DAILY_REQUEST_LIMIT=18
GOOGLE_PLACES_MONTHLY_REQUEST_LIMIT=900
GOOGLE_PLACES_REQUESTS_PER_MINUTE=5
MAX_SEARCH_RESULTS=50
OUTREACH_JOB_RETENTION_HOURS=168
```

Do not set `PORT` unless the host explicitly requires it. Most Node hosts
provide it automatically.

Deploy once, then open:

```text
https://your-api-host/api/health
```

It should return `{"status":"ok"}`. Keep both Google-related flags false for
this first backend deployment.

## 3. Create the frontend deployment

Create a Vercel project from the same repository. Set its root directory to
`frontend`. Configure these build-time environment values:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
VITE_API_URL=https://your-api-host
```

Deploy it, then copy the exact public Vercel URL.

## 4. Connect the exact frontend URL

1. Update the backend host's `CORS_ORIGIN` to the exact Vercel URL. Include
   `http://localhost:5173` too, separated by a comma, if local development
   must continue.
2. Redeploy the backend after changing that setting.
3. In Supabase Auth settings, add the same Vercel URL as the Site URL and an
   allowed redirect URL. Keep `http://localhost:5173` for local development.
4. Redeploy the Vercel frontend only if its build-time variables changed.

Example:

```env
CORS_ORIGIN=http://localhost:5173,https://your-vercel-project-url
```

## 5. Verify safely in fixture mode

1. Open the hosted dashboard and sign in.
2. Confirm the usage card says Google is disabled.
3. Build a fixture list, open a recent list, and download both CSV files.
4. Check that the browser has no CORS errors and that password recovery returns
   to the hosted dashboard.

Do not enable Google until this fixture-mode deployment works.

## 6. Enable the controlled live beta

When fixture mode works, change only the backend-host environment values:

```env
GOOGLE_PLACES_ENABLED=true
WEBSITE_EMAIL_DISCOVERY_ENABLED=true
```

Redeploy or restart the backend, then confirm the signed-in dashboard says
**Live Google mode**. The 18-request daily limit supports at most three
50-business lists with nearby fill in one day.

Start with one small live list after deployment. Review the Google usage,
website-check duration, CSV quality, and host logs before allowing all three
lists.

## 7. Keep the beta private and reversible

- Invite only intended users through Supabase Auth.
- Keep the Google and Supabase secret keys in backend-host settings only.
- Set both Google-related backend flags to `false` and redeploy to stop all
  future Google and public-website requests immediately.
- Review Google Cloud budget alerts and the backend usage card regularly.
- When Simplicate provides its Google Cloud project/key, replace only the
  backend host's `GOOGLE_PLACES_API_KEY`; do not change frontend code.

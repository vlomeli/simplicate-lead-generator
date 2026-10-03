# Google Places setup

Keep Google disabled until Supabase works in fixture mode and a live test is
intentional. The application can run completely without a Google API key.

## 1. Create and secure the Google Cloud project

1. Create a dedicated Google Cloud project for this application.
2. Attach billing before enabling Google Places. Google billing and free usage
   terms can change, so review them in the Google Cloud console before live use.
3. Enable the Places API required by the current Google Places integration.
4. Create an API key for the backend only.
5. Restrict that key to the Places API. Once the backend is hosted, also apply
   the strongest application restriction supported by that host.

Never put `GOOGLE_PLACES_API_KEY` in the frontend, a client-side build, Git,
screenshots, or chat. Store it only in `backend/.env` locally and the backend
host's secret environment settings after deployment.

## 2. Set Google Cloud alerts and quotas

Create a Google Cloud billing budget and alert at:

- 50% of the monthly amount you are comfortable spending
- 80%
- 90%

Use the lowest practical Places quota where Google Cloud allows it. Alerts and
quotas are secondary safeguards. The backend's daily and monthly reservation
limits are the immediate stop that prevents this application from making a
request after its configured allowance is used.

## 3. Configure the backend safely

Copy `backend/.env.example` to `backend/.env` and add the API key:

```env
GOOGLE_PLACES_API_KEY=your_backend_only_key
GOOGLE_PLACES_ENABLED=false
WEBSITE_EMAIL_DISCOVERY_ENABLED=false
GOOGLE_PLACES_DAILY_REQUEST_LIMIT=5
GOOGLE_PLACES_MONTHLY_REQUEST_LIMIT=900
GOOGLE_PLACES_REQUESTS_PER_MINUTE=5
```

Restart the backend after every `.env` change.

Begin with both feature flags set to `false`. Turn on `GOOGLE_PLACES_ENABLED`
only for a deliberate live test. Turn on
`WEBSITE_EMAIL_DISCOVERY_ENABLED` only when public website checks are also
intended.

## 4. Development allowance for three 50-business lists per day

Google can return up to 20 businesses per Text Search page. A 50-business
list can use up to three Google requests. If nearby fill is enabled and needed,
it can use another three.

| Activity | Maximum Google Places requests |
| --- | ---: |
| One 50-business list, exact location only | 3 |
| One 50-business list with nearby fill | 6 |
| Three lists with nearby fill in one day | 18 |
| Thirty such days | 540 |

If that is the intentional development plan, set:

```env
GOOGLE_PLACES_DAILY_REQUEST_LIMIT=18
GOOGLE_PLACES_MONTHLY_REQUEST_LIMIT=900
GOOGLE_PLACES_REQUESTS_PER_MINUTE=5
```

These limits are application safeguards, not a promise that Google Cloud will
remain free. Verify current pricing, quotas, and your billing budget before
enabling live traffic.

## 5. Run a controlled live test

1. Confirm the dashboard usage card shows remaining allowance.
2. Set `GOOGLE_PLACES_ENABLED=true` and restart the backend.
3. Keep the target count small for the first test.
4. Check the usage card and Google Cloud console afterward.
5. Set the flag back to `false` when the test is complete.

Website email discovery makes no Google Places requests, but it does issue
public website requests. It checks no more than three pages per business and
can miss emails rendered only by browser JavaScript or blocked behind `403`.

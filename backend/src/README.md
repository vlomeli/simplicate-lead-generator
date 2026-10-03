# Backend source guide

- `app.js` configures Express, shared middleware, health, and route mounts.
- `server.js` loads configuration and starts the API.
- `config/env.js` is the only place that reads and validates environment values.
- `routes/` defines endpoint paths and authentication/limit middleware.
- `controllers/` translates HTTP requests and responses.
- `services/` owns Google Places, Supabase, CSV, outreach-job, and website email-discovery workflows.
- `scripts/diagnoseWebsiteEmail.js` checks one website page without Google or Supabase writes.
- `utils/` holds small deterministic transformations.

For list building, follow this path:

```text
outreachRoutes → outreachController → outreachJobService
             → provider/email services and outreachRepository
```

`outreachJobService.js` is the coordination point. It keeps website checks bounded and delegates all temporary database records to `outreachRepository.js`. Permanent duplicate prevention remains in `place_registry` through its server-only SQL function.

The legacy direct-search files (`leadController.js`, `leadService.js`, and related repository/CSV files) remain because `/api/leads/usage` shares the lead route and the original migration created their tables. The dashboard's current list-building workflow uses `/api/outreach/jobs`.

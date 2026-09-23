# Backend source guide

- `app.js` configures Express, middleware, routes, and shared HTTP responses.
- `server.js` loads configuration and starts the API.
- `config/` contains configuration read from environment variables.
- `routes/` declares endpoint paths and maps them to controllers.
- `controllers/` handles HTTP request and response details.
- `services/` contains the lead-discovery workflow and external integrations.
- `utils/` contains small, reusable data transformations.

When implementing a feature, start at its route, follow it to the controller, then put the actual business logic in a service.

Configuration belongs only in `config/env.js`. Do not read `process.env` from
controllers, services, or utilities. The health route must work without a
Google key; a future live-search service will validate the key immediately
before it makes an external request.

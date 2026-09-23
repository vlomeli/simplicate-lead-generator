import dotenv from 'dotenv';

// Load .env before reading values. This keeps configuration behavior consistent
// for the running server and for future scripts or tests that import config.
dotenv.config();

/**
 * Reads a positive whole-number setting while failing early for unsafe values.
 * Keeping parsing here prevents each service from inventing its own defaults.
 */
export function readPositiveInteger(value, { name, defaultValue }) {
  if (value === undefined || value === '') {
    return defaultValue;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${name} must be a positive whole number.`);
  }

  return parsedValue;
}

/**
 * Creates application configuration from an environment-like object.
 * Exported separately from `config` so the rules can be tested without
 * changing process.env or requiring a real API key.
 */
export function createConfig(environment = process.env) {
  return {
    environment: environment.NODE_ENV || 'development',
    port: readPositiveInteger(environment.PORT, {
      name: 'PORT',
      defaultValue: 5000,
    }),
    googlePlacesApiKey: environment.GOOGLE_PLACES_API_KEY || '',
    googlePlacesMonthlyRequestLimit: readPositiveInteger(
      environment.GOOGLE_PLACES_MONTHLY_REQUEST_LIMIT,
      {
        name: 'GOOGLE_PLACES_MONTHLY_REQUEST_LIMIT',
        defaultValue: 900,
      },
    ),
    googlePlacesDailyRequestLimit: readPositiveInteger(
      environment.GOOGLE_PLACES_DAILY_REQUEST_LIMIT,
      {
        name: 'GOOGLE_PLACES_DAILY_REQUEST_LIMIT',
        defaultValue: 5,
      },
    ),
    googlePlacesRequestsPerMinute: readPositiveInteger(
      environment.GOOGLE_PLACES_REQUESTS_PER_MINUTE,
      {
        name: 'GOOGLE_PLACES_REQUESTS_PER_MINUTE',
        defaultValue: 5,
      },
    ),
    maxSearchResults: readPositiveInteger(environment.MAX_SEARCH_RESULTS, {
      name: 'MAX_SEARCH_RESULTS',
      defaultValue: 50,
    }),
  };
}

// Keep environment variable names and their safe defaults in one place.
export const config = createConfig();

/**
 * The health route intentionally works without a Google key. Call this before
 * making a live Places request so configuration errors remain safe and clear.
 */
export function getGooglePlacesConfigurationError(activeConfig = config) {
  if (!activeConfig.googlePlacesApiKey) {
    return 'Google Places is not configured. Set GOOGLE_PLACES_API_KEY in backend/.env.';
  }

  return null;
}

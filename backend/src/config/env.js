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

export function readBoolean(value, { name, defaultValue }) {
  if (value === undefined || value === '') return defaultValue;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${name} must be either true or false.`);
}

/**
 * Reads one or more exact dashboard origins for browser CORS requests. The
 * host can supply a comma-separated local and production allowlist.
 */
export function readAllowedOrigins(value, { name, defaultValue }) {
  const rawOrigins = value === undefined || value === '' ? defaultValue : value;
  const origins = rawOrigins.split(',').map(origin => origin.trim()).filter(Boolean);

  if (!origins.length) throw new Error(`${name} must contain at least one HTTP(S) origin.`);

  return origins.map(origin => {
    const normalizedOrigin = origin.endsWith('/') ? origin.slice(0, -1) : origin;
    let parsed;
    try {
      parsed = new URL(normalizedOrigin);
    } catch {
      throw new Error(`${name} must contain valid HTTP(S) origins.`);
    }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== normalizedOrigin) {
      throw new Error(`${name} must contain valid HTTP(S) origins.`);
    }
    return parsed.origin;
  });
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
    corsOrigins: readAllowedOrigins(environment.CORS_ORIGIN, {
      name: 'CORS_ORIGIN',
      defaultValue: 'http://localhost:5173',
    }),
    googlePlacesApiKey: environment.GOOGLE_PLACES_API_KEY || '',
    googlePlacesEnabled: readBoolean(environment.GOOGLE_PLACES_ENABLED, {
      name: 'GOOGLE_PLACES_ENABLED',
      defaultValue: false,
    }),
    websiteEmailDiscoveryEnabled: readBoolean(environment.WEBSITE_EMAIL_DISCOVERY_ENABLED, {
      name: 'WEBSITE_EMAIL_DISCOVERY_ENABLED',
      defaultValue: false,
    }),
    supabaseUrl: environment.SUPABASE_URL || '',
    supabaseServiceRoleKey: environment.SUPABASE_SERVICE_ROLE_KEY || '',
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
    outreachJobRetentionHours: readPositiveInteger(environment.OUTREACH_JOB_RETENTION_HOURS, {
      name: 'OUTREACH_JOB_RETENTION_HOURS',
      defaultValue: 168,
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
  if (!activeConfig.googlePlacesEnabled) {
    return 'Google Places is disabled. Set GOOGLE_PLACES_ENABLED=true only after approving live usage.';
  }

  if (!activeConfig.googlePlacesApiKey) {
    return 'Google Places is not configured. Set GOOGLE_PLACES_API_KEY in backend/.env.';
  }

  return null;
}

/**
 * Supabase is optional while running the starter health route, but required
 * before the backend can access protected application data.
 */
export function getSupabaseConfigurationError(activeConfig = config) {
  if (!activeConfig.supabaseUrl) {
    return 'Supabase is not configured. Set SUPABASE_URL in backend/.env.';
  }

  if (!activeConfig.supabaseServiceRoleKey) {
    return 'Supabase is not configured. Set SUPABASE_SERVICE_ROLE_KEY in backend/.env.';
  }

  return null;
}

import dotenv from 'dotenv';

// Load .env before reading values. This keeps configuration behavior consistent
// for the running server and for future scripts or tests that import config.
dotenv.config();

// Keep environment variable names in one place so configuration is easy to find.
export const config = {
  port: Number(process.env.PORT) || 5000,
  googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY || '',
};

import { config } from '../config/env.js';

// This is intentionally not called by fixture searches: local fixtures make no
// provider request.  The future live provider adapter must reserve before its
// first network request.
export async function reservePlacesUsage(client, activeConfig = config) {
  const { data, error } = await client.rpc('reserve_places_usage', {
    p_daily_limit: activeConfig.googlePlacesDailyRequestLimit,
    p_monthly_limit: activeConfig.googlePlacesMonthlyRequestLimit,
  });

  if (error) throw new Error('Unable to reserve Places API usage.', { cause: error });
  const reservation = Array.isArray(data) ? data[0] : data;
  if (!reservation) throw new Error('Usage reservation returned no result.');
  return reservation;
}

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

// Fixture searches do not reserve provider requests, so this naturally reads
// as zero until a future approved live provider begins making reservations.
export async function getPlacesUsage(client, activeConfig = config, now = new Date()) {
  const usageDate = now.toISOString().slice(0, 10);
  const monthStart = `${usageDate.slice(0, 7)}-01`;
  const [{ data: daily, error: dailyError }, { data: monthly, error: monthlyError }] = await Promise.all([
    client.from('places_usage_daily').select('request_count').eq('usage_date', usageDate).maybeSingle(),
    client.from('places_usage_monthly').select('request_count').eq('month_start', monthStart).maybeSingle(),
  ]);

  if (dailyError || monthlyError) throw new Error('Unable to read Places usage.', { cause: dailyError ?? monthlyError });
  const dailyUsed = daily?.request_count ?? 0;
  const monthlyUsed = monthly?.request_count ?? 0;
  const nextMonthReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();

  return {
    fixtureMode: true,
    daily: { limit: activeConfig.googlePlacesDailyRequestLimit, used: dailyUsed, remaining: Math.max(0, activeConfig.googlePlacesDailyRequestLimit - dailyUsed) },
    monthly: { limit: activeConfig.googlePlacesMonthlyRequestLimit, used: monthlyUsed, remaining: Math.max(0, activeConfig.googlePlacesMonthlyRequestLimit - monthlyUsed), resetAt: nextMonthReset },
  };
}

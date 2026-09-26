import { config, getGooglePlacesConfigurationError } from '../config/env.js';
import { reservePlacesUsage } from './usageService.js';

const textSearchUrl = 'https://places.googleapis.com/v1/places:searchText';
export const maxGooglePlacesTextSearchResults = 20;
const fieldMask = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.primaryType',
].join(',');

export class GooglePlacesConfigurationError extends Error {}
export class GooglePlacesUsageLimitError extends Error {}
export class GooglePlacesProviderError extends Error {}

// Google Places Text Search is intentionally called only by the backend. One
// usage reservation is made immediately before the one outbound request.
export async function searchGooglePlaces(searchRequest, options = {}) {
  const activeConfig = options.config ?? config;
  const configurationError = getGooglePlacesConfigurationError(activeConfig);
  if (configurationError) throw new GooglePlacesConfigurationError(configurationError);

  const reservation = await (options.reserveUsage ?? reservePlacesUsage)(options.client, activeConfig);
  if (!reservation.reserved) {
    throw new GooglePlacesUsageLimitError('The configured Google Places allowance has been reached.');
  }

  const fetchRequest = options.fetch ?? globalThis.fetch;
  if (typeof fetchRequest !== 'function') throw new GooglePlacesProviderError('Fetch is unavailable for Google Places.');

  let response;
  try {
    response = await fetchRequest(textSearchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': activeConfig.googlePlacesApiKey,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify({
        textQuery: `${searchRequest.query.trim()} in ${searchRequest.location.trim()}`,
        maxResultCount: searchRequest.maxResults,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new GooglePlacesProviderError('Google Places could not be reached.', { cause: error });
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    throw new GooglePlacesProviderError('Google Places returned an invalid response.', { cause: error });
  }

  if (!response.ok) {
    throw new GooglePlacesProviderError(`Google Places returned HTTP ${response.status}.`);
  }

  return Array.isArray(payload.places) ? payload.places : [];
}

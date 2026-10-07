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
// usage reservation is made immediately before every outbound request.
export async function searchGooglePlacesPage(searchRequest, options = {}) {
  const activeConfig = options.config ?? config;
  const configurationError = getGooglePlacesConfigurationError(activeConfig);
  if (configurationError) throw new GooglePlacesConfigurationError(configurationError);

  const reservation = await (options.reserveUsage ?? reservePlacesUsage)(options.client, activeConfig);
  if (!reservation.reserved) {
    const error = new GooglePlacesUsageLimitError('The configured Google Places allowance has been reached.');
    error.limitType = reservation.daily_remaining === 0 ? 'daily' : 'monthly';
    throw error;
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
      body: JSON.stringify(searchRequest.pageToken
        ? { pageToken: searchRequest.pageToken }
        : {
          textQuery: `${searchRequest.query.trim()} ${searchRequest.searchNearby ? 'near' : 'in'} ${searchRequest.location.trim()}`,
          maxResultCount: Math.min(searchRequest.maxResults, maxGooglePlacesTextSearchResults),
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

  return {
    places: Array.isArray(payload.places) ? payload.places : [],
    nextPageToken: typeof payload.nextPageToken === 'string' ? payload.nextPageToken : null,
  };
}

// Keeps the original single-page provider interface for the existing search
// route while outreach jobs can safely request additional pages up to 50.
export async function searchGooglePlaces(searchRequest, options = {}) {
  const page = await searchGooglePlacesPage(searchRequest, options);
  return page.places;
}

export async function searchGooglePlacesBatch(searchRequest, options = {}) {
  const targetCount = Math.min(searchRequest.maxResults, 50);
  const maxPages = Math.min(searchRequest.maxPages ?? Math.ceil(targetCount / maxGooglePlacesTextSearchResults), 3);
  const places = [];
  let pageToken = null;
  let pagesFetched = 0;

  do {
    const page = await searchGooglePlacesPage({
      ...searchRequest,
      maxResults: Math.min(targetCount - places.length, maxGooglePlacesTextSearchResults),
      pageToken,
    }, options);
    places.push(...page.places);
    pageToken = page.nextPageToken;
    pagesFetched += 1;
  } while (pageToken && places.length < targetCount && pagesFetched < maxPages);

  return places.slice(0, targetCount);
}

import { config } from '../config/env.js';
import {
  GooglePlacesConfigurationError,
  GooglePlacesProviderError,
  GooglePlacesUsageLimitError,
  maxGooglePlacesTextSearchResults,
} from '../services/googlePlacesService.js';
import { findNewLeads } from '../services/leadService.js';

export async function searchLeads(request, response) {
  const maximumResults = config.googlePlacesEnabled
    ? Math.min(config.maxSearchResults, maxGooglePlacesTextSearchResults)
    : config.maxSearchResults;
  const validationError = validateSearchRequest(request.body, maximumResults);
  if (validationError) {
    response.status(400).json({ error: validationError });
    return;
  }

  try {
    const result = await findNewLeads(request.body, { userId: request.user.id });
    response.status(200).json(result);
  } catch (error) {
    if (error instanceof GooglePlacesUsageLimitError) {
      response.status(429).json({ error: 'Google Places usage limit reached. Wait for the reset before searching again.' });
      return;
    }
    if (error instanceof GooglePlacesConfigurationError) {
      response.status(503).json({ error: 'Google Places is not enabled on this server.' });
      return;
    }
    if (error instanceof GooglePlacesProviderError) {
      response.status(502).json({ error: 'Google Places could not complete the search. Try again later.' });
      return;
    }
    response.status(500).json({ error: 'Unable to complete the lead search.' });
  }
}

export function validateSearchRequest(body, maximumResults) {
  if (typeof body?.query !== 'string' || body.query.trim() === '') return 'query must be a non-empty string.';
  if (typeof body?.location !== 'string' || body.location.trim() === '') return 'location must be a non-empty string.';
  if (!Number.isInteger(body?.maxResults) || body.maxResults < 1 || body.maxResults > maximumResults) {
    return `maxResults must be a whole number between 1 and ${maximumResults}.`;
  }
  return null;
}

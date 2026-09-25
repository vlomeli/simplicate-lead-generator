import { config } from '../config/env.js';
import { findNewLeads } from '../services/leadService.js';

export async function searchLeads(request, response) {
  const validationError = validateSearchRequest(request.body, config.maxSearchResults);
  if (validationError) {
    response.status(400).json({ error: validationError });
    return;
  }

  try {
    const result = await findNewLeads(request.body, { userId: request.user.id });
    response.status(200).json(result);
  } catch (error) {
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

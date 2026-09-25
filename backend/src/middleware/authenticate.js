import { getSupabaseConfigurationError } from '../config/env.js';
import { createSupabaseClient } from '../services/supabaseClient.js';

export function getBearerToken(authorization) {
  if (typeof authorization !== 'string') return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match?.[1] || null;
}

// Browser access tokens are verified by Supabase Auth.  Application data is
// still accessed only with the server-side client created below.
export async function requireAuthenticatedUser(request, response, next, dependencies = {}) {
  const configurationError = dependencies.getConfigurationError?.() ?? getSupabaseConfigurationError();
  if (configurationError) {
    response.status(503).json({ error: 'Authenticated lead access is not configured.' });
    return;
  }

  const token = getBearerToken(request.get('authorization'));
  if (!token) {
    response.status(401).json({ error: 'A valid Bearer access token is required.' });
    return;
  }

  try {
    const client = dependencies.client ?? createSupabaseClient();
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) {
      response.status(401).json({ error: 'The access token is invalid or expired.' });
      return;
    }

    request.user = { id: data.user.id, email: data.user.email ?? null };
    next();
  } catch {
    response.status(503).json({ error: 'Authentication is temporarily unavailable.' });
  }
}

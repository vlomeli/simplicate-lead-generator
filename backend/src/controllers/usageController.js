import { config } from '../config/env.js';
import { createSupabaseClient } from '../services/supabaseClient.js';
import { getPlacesUsage } from '../services/usageService.js';

export async function getLeadUsage(_request, response) {
  try {
    const usage = await getPlacesUsage(createSupabaseClient(), config);
    response.status(200).json(usage);
  } catch {
    response.status(500).json({ error: 'Unable to retrieve usage information.' });
  }
}

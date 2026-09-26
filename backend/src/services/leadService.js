import { exportLeadsToCsv } from './csvExportService.js';
import { searchFixturePlaces } from './fixturePlacesService.js';
import { searchGooglePlaces } from './googlePlacesService.js';
import { createSupabaseClient } from './supabaseClient.js';
import { persistNewLeads, recordLeadExport, recordLeadSearch } from './leadRepository.js';
import { normalizeLead } from '../utils/leadNormalizer.js';
import { config } from '../config/env.js';

// The provider is chosen only on the server from the explicit feature flag.
export async function findNewLeads(searchRequest, options = {}) {
  const activeConfig = options.config ?? config;
  const source = activeConfig.googlePlacesEnabled ? 'google_places' : 'fixture';
  const { userId, exportCsv = exportLeadsToCsv } = options;
  const client = options.client ?? createSupabaseClient();
  const saveSearch = options.recordLeadSearch ?? recordLeadSearch;
  const searchPlaces = options.searchPlaces ?? (activeConfig.googlePlacesEnabled
    ? request => searchGooglePlaces(request, { client, config: activeConfig })
    : searchFixturePlaces);
  try {
    const rawPlaces = await searchPlaces(searchRequest);
    const normalizedLeads = rawPlaces.map(normalizeLead);
    const newLeads = await (options.persistNewLeads ?? persistNewLeads)(client, normalizedLeads);
    const exportInfo = await exportCsv(newLeads);

    await (options.recordLeadExport ?? recordLeadExport)(client, { userId, exportInfo });
    await saveSearch(client, { userId, searchRequest, status: 'succeeded' });

    return { leads: newLeads, export: exportInfo, source };
  } catch (error) {
    // Preserve an audit record when possible without obscuring the original error.
    try {
      await saveSearch(client, { userId, searchRequest, status: 'failed', failureCode: `${source}_workflow_failed` });
    } catch {}
    throw error;
  }
}

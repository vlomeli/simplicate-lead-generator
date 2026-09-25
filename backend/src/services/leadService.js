import { exportLeadsToCsv } from './csvExportService.js';
import { searchFixturePlaces } from './fixturePlacesService.js';
import { createSupabaseClient } from './supabaseClient.js';
import { persistNewLeads, recordLeadExport, recordLeadSearch } from './leadRepository.js';
import { normalizeLead } from '../utils/leadNormalizer.js';

// Offline Stage 1 workflow. It intentionally uses fixtures, never Google.
export async function findNewLeads(searchRequest, options = {}) {
  const { userId, searchPlaces = searchFixturePlaces, exportCsv = exportLeadsToCsv } = options;
  const client = options.client ?? createSupabaseClient();
  const saveSearch = options.recordLeadSearch ?? recordLeadSearch;
  try {
    const rawPlaces = await searchPlaces(searchRequest);
    const normalizedLeads = rawPlaces.map(normalizeLead);
    const newLeads = await (options.persistNewLeads ?? persistNewLeads)(client, normalizedLeads);
    const exportInfo = await exportCsv(newLeads);

    await (options.recordLeadExport ?? recordLeadExport)(client, { userId, exportInfo });
    await saveSearch(client, { userId, searchRequest, status: 'succeeded' });

    return { leads: newLeads, export: exportInfo, source: 'fixture' };
  } catch (error) {
    // Preserve an audit record when possible without obscuring the original error.
    try {
      await saveSearch(client, { userId, searchRequest, status: 'failed', failureCode: 'fixture_workflow_failed' });
    } catch {}
    throw error;
  }
}

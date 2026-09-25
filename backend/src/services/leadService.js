import { exportLeadsToCsv } from './csvExportService.js';
import { searchFixturePlaces } from './fixturePlacesService.js';
import { removeDuplicateLeads } from '../utils/deduplicateLeads.js';
import { normalizeLead } from '../utils/leadNormalizer.js';

const collectedPlaceIds = new Set();

// Offline Stage 1 workflow. It intentionally uses fixtures, never Google.
export async function findNewLeads(searchRequest, dependencies = {}) {
  const searchPlaces = dependencies.searchPlaces ?? searchFixturePlaces;
  const exportCsv = dependencies.exportCsv ?? exportLeadsToCsv;
  const rawPlaces = await searchPlaces(searchRequest);
  const normalizedLeads = rawPlaces.map(normalizeLead);
  const newLeads = removeDuplicateLeads(normalizedLeads, collectedPlaceIds);
  const exportInfo = await exportCsv(newLeads);

  return { leads: newLeads, export: exportInfo, source: 'fixture' };
}

export function resetCollectedPlaceIdsForTest() {
  collectedPlaceIds.clear();
}

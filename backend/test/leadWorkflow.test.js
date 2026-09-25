import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { validateSearchRequest } from '../src/controllers/leadController.js';
import { exportLeadsToCsv } from '../src/services/csvExportService.js';
import { findNewLeads } from '../src/services/leadService.js';
import { removeDuplicateLeads } from '../src/utils/deduplicateLeads.js';
import { normalizeLead } from '../src/utils/leadNormalizer.js';

test('normalizes a Google Places API (New) result into the application contract', () => {
  const lead = normalizeLead({
    id: 'place-1', displayName: { text: 'A "Quoted" Business' },
    formattedAddress: '1 Main St, Modesto, CA', rating: 4.2,
    userRatingCount: 12, primaryType: 'auto_repair',
  });

  assert.deepEqual(lead, {
    placeId: 'place-1', name: 'A "Quoted" Business', address: '1 Main St, Modesto, CA',
    phone: null, website: null, rating: 4.2, reviewCount: 12,
    category: 'auto_repair', recipientEmail: null, emailStatus: 'not_sent',
  });
});

test('deduplication keeps only the first occurrence of each place ID', () => {
  const collected = new Set(['already-seen']);
  const leads = [{ placeId: 'already-seen' }, { placeId: 'new' }, { placeId: 'new' }];
  assert.deepEqual(removeDuplicateLeads(leads, collected), [{ placeId: 'new' }]);
  assert.deepEqual([...collected].sort(), ['already-seen', 'new']);
});

test('CSV export preserves commas and quotes and uses the documented headers', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'lead-csv-'));
  try {
    const result = await exportLeadsToCsv([{
      placeId: 'place-1', name: 'A "Quoted", Business', address: null, phone: null,
      website: null, rating: null, reviewCount: null, category: null,
      recipientEmail: null, emailStatus: 'not_sent',
    }], { exportDirectory: directory });
    const csv = await readFile(result.filePath, 'utf8');
    assert.match(csv, /^"place_id","business_name","address"/);
    assert.match(csv, /"A ""Quoted"", Business"/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('offline workflow persists and exports only leads newly claimed by the registry', async () => {
  const exports = [];
  let invocation = 0;
  const options = {
    userId: 'user-1',
    client: {},
    exportCsv: async leads => {
      exports.push(leads);
      return { filename: 'test.csv', filePath: '/tmp/test.csv', leadCount: leads.length };
    },
    persistNewLeads: async (_client, leads) => (++invocation === 1 ? leads.slice(0, 2) : []),
    recordLeadExport: async () => {},
    recordLeadSearch: async () => {},
  };
  const request = { query: 'auto repair', location: 'Modesto, CA', maxResults: 3 };

  const first = await findNewLeads(request, options);
  const second = await findNewLeads(request, options);
  assert.equal(first.source, 'fixture');
  assert.equal(first.leads.length, 2);
  assert.equal(second.leads.length, 0);
  assert.equal(exports.length, 2);
});

test('search validation rejects unsafe inputs before services run', () => {
  assert.equal(validateSearchRequest({ query: '', location: 'Modesto', maxResults: 1 }, 50), 'query must be a non-empty string.');
  assert.equal(validateSearchRequest({ query: 'auto repair', location: 'Modesto', maxResults: 51 }, 50), 'maxResults must be a whole number between 1 and 50.');
  assert.equal(validateSearchRequest({ query: 'auto repair', location: 'Modesto', maxResults: 1 }, 50), null);
});

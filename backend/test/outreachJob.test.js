import assert from 'node:assert/strict';
import test from 'node:test';

import { createFullResultsCsv, createOutreachCsv } from '../src/services/outreachCsvService.js';
import { executeOutreachJob } from '../src/services/outreachJobService.js';

test('outreach job stores only newly claimed businesses and their email outcomes', async () => {
  const updates = [];
  const results = [];
  await executeOutreachJob({
    id: 'job-1', query: 'auto repair', location: 'Modesto, CA', target_count: 2, source: 'fixture',
  }, {
    client: {},
    updateJob: async (_client, _id, values) => { updates.push(values); },
    searchPlaces: async () => [
      { id: 'place-new', displayName: { text: 'New Shop' }, websiteUri: 'https://new.example' },
      { id: 'place-known', displayName: { text: 'Known Shop' } },
    ],
    claimPlaceId: async (_client, placeId) => placeId === 'place-new',
    checkEmail: async () => ({ status: 'found', email: 'hello@new.example', sourceUrl: 'https://new.example/contact' }),
    addResult: async (_client, result) => { results.push(result); },
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].recipient_email, 'hello@new.example');
  assert.equal(results[0].email_status, 'found');
  assert.equal(updates.at(-1).status, 'completed');
  assert.equal(updates.at(-1).businesses_found, 1);
  assert.equal(updates.at(-1).emails_found, 1);
});

test('outreach and full CSV exports have the intended retention-safe columns', () => {
  const results = [
    { recipient_email: 'hello@shop.example', business_name: 'Shop', address: null, phone: null, website: null, rating: 4.8, review_count: 185, category: 'car_repair', place_id: 'place-1', email_source_url: 'https://shop.example/contact', email_status: 'found' },
    { recipient_email: null, business_name: 'No Email Shop', address: null, phone: null, website: null, rating: null, review_count: null, category: null, place_id: 'place-2', email_source_url: null, email_status: 'not_found' },
  ];

  const outreachCsv = createOutreachCsv(results);
  const fullCsv = createFullResultsCsv(results);
  assert.match(outreachCsv, /^"email","name","address","phone","website","rating","reviews"/);
  assert.match(outreachCsv, /hello@shop\.example/);
  assert.doesNotMatch(outreachCsv, /No Email Shop/);
  assert.match(fullCsv, /"email_status"/);
  assert.match(fullCsv, /No Email Shop/);
});

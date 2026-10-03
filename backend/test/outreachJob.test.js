import assert from 'node:assert/strict';
import test from 'node:test';

import { createFullResultsCsv, createOutreachCsv } from '../src/services/outreachCsvService.js';
import { executeOutreachJob } from '../src/services/outreachJobService.js';
import { GooglePlacesUsageLimitError } from '../src/services/googlePlacesService.js';

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

test('live outreach passes a business website URL to public-email discovery', async () => {
  const websitesChecked = [];
  const results = [];
  await executeOutreachJob({
    id: 'job-live-1', query: 'funeral home', location: 'San Jose, CA', target_count: 1, source: 'google_places',
  }, {
    client: {},
    config: { websiteEmailDiscoveryEnabled: true },
    updateJob: async () => {},
    searchPlaces: async () => [
      { id: 'place-live', displayName: { text: 'Family Funeral Home' }, websiteUri: 'https://business.test/' },
    ],
    claimPlaceId: async () => true,
    discoverWebsiteEmail: async website => {
      websitesChecked.push(website);
      return { status: 'found', email: 'hello@business.test', sourceUrl: website };
    },
    addResult: async (_client, result) => { results.push(result); },
  });

  assert.deepEqual(websitesChecked, ['https://business.test/']);
  assert.equal(results[0].recipient_email, 'hello@business.test');
});

test('fills a short primary search with opted-in nearby results', async () => {
  const requests = [];
  const updates = [];
  await executeOutreachJob({
    id: 'job-nearby-1', query: 'funeral homes', location: 'Tracy, CA', target_count: 3, source: 'google_places', include_nearby: true,
  }, {
    client: {},
    updateJob: async (_client, _id, values) => { updates.push(values); },
    searchPlaces: async request => {
      requests.push(request);
      return request.searchNearby
        ? [
          { id: 'nearby-1', displayName: { text: 'Nearby One' } },
          { id: 'nearby-2', displayName: { text: 'Nearby Two' } },
        ]
        : [{ id: 'primary-1', displayName: { text: 'Primary One' } }];
    },
    claimPlaceId: async () => true,
    checkEmail: async () => ({ status: 'no_website' }),
    addResult: async () => {},
  });

  assert.equal(requests.length, 2);
  assert.equal(requests[1].searchNearby, true);
  assert.equal(updates.at(-1).businesses_found, 3);
  assert.equal(updates.at(-1).primary_businesses_found, 1);
  assert.equal(updates.at(-1).nearby_businesses_found, 2);
});

test('records a daily-limit failure without adding a zero-result outreach list', async () => {
  const updates = [];
  const limitError = new GooglePlacesUsageLimitError('The configured Google Places allowance has been reached.');
  limitError.limitType = 'daily';
  await executeOutreachJob({
    id: 'job-limit-1', query: 'auto repair', location: 'Los Angeles, CA', target_count: 1, source: 'google_places',
  }, {
    client: {},
    updateJob: async (_client, _id, values) => { updates.push(values); },
    searchPlaces: async () => { throw limitError; },
  });

  assert.equal(updates.at(-1).status, 'failed');
  assert.equal(updates.at(-1).failure_code, 'google_places_daily_limit_reached');
  assert.ok(updates.at(-1).completed_at);
});

test('outreach and full CSV exports have the intended retention-safe columns', () => {
  const results = [
    { recipient_email: 'hello@shop.example', business_name: 'Shop', address: null, phone: null, website: null, rating: 4.8, review_count: 185, category: 'car_repair', place_id: 'place-1', email_source_url: 'https://shop.example/contact', email_status: 'found' },
    { recipient_email: null, business_name: 'No Email Shop', address: null, phone: null, website: null, rating: null, review_count: null, category: null, place_id: 'place-2', email_source_url: null, email_status: 'failed', failure_code: 'http_403' },
  ];

  const outreachCsv = createOutreachCsv(results);
  const fullCsv = createFullResultsCsv(results);
  assert.match(outreachCsv, /^"email","name","address","phone","website","rating","reviews"/);
  assert.match(outreachCsv, /hello@shop\.example/);
  assert.doesNotMatch(outreachCsv, /No Email Shop/);
  assert.match(fullCsv, /"email_status"/);
  assert.match(fullCsv, /"email_failure_code"/);
  assert.match(fullCsv, /http_403/);
  assert.match(fullCsv, /No Email Shop/);
});

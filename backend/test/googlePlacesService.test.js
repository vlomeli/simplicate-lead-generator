import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GooglePlacesUsageLimitError,
  searchGooglePlaces,
} from '../src/services/googlePlacesService.js';

const liveConfig = {
  googlePlacesEnabled: true,
  googlePlacesApiKey: 'test-key',
  googlePlacesDailyRequestLimit: 5,
  googlePlacesMonthlyRequestLimit: 900,
};

test('live Google search reserves usage before making its mocked provider request', async () => {
  const calls = [];
  const places = await searchGooglePlaces({
    query: 'auto repair', location: 'Modesto, CA', maxResults: 1,
  }, {
    client: {},
    config: liveConfig,
    reserveUsage: async () => { calls.push('reserve'); return { reserved: true }; },
    fetch: async (url, options) => {
      calls.push('fetch');
      assert.equal(url, 'https://places.googleapis.com/v1/places:searchText');
      assert.equal(options.headers['X-Goog-Api-Key'], 'test-key');
      assert.deepEqual(JSON.parse(options.body), {
        textQuery: 'auto repair in Modesto, CA', maxResultCount: 1,
      });
      return { ok: true, json: async () => ({ places: [{ id: 'place-1' }] }) };
    },
  });

  assert.deepEqual(calls, ['reserve', 'fetch']);
  assert.deepEqual(places, [{ id: 'place-1' }]);
});

test('a blocked reservation prevents a mocked Google request', async () => {
  let fetched = false;
  await assert.rejects(
    searchGooglePlaces({ query: 'auto repair', location: 'Modesto, CA', maxResults: 1 }, {
      client: {}, config: liveConfig,
      reserveUsage: async () => ({ reserved: false }),
      fetch: async () => { fetched = true; },
    }),
    GooglePlacesUsageLimitError,
  );
  assert.equal(fetched, false);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { createConfig, readPositiveInteger } from '../src/config/env.js';

test('createConfig uses documented safe defaults', () => {
  const config = createConfig({});

  assert.equal(config.port, 5000);
  assert.equal(config.googlePlacesMonthlyRequestLimit, 900);
  assert.equal(config.googlePlacesDailyRequestLimit, 5);
  assert.equal(config.googlePlacesRequestsPerMinute, 5);
  assert.equal(config.maxSearchResults, 50);
  assert.equal(config.googlePlacesApiKey, '');
});

test('createConfig accepts valid environment overrides', () => {
  const config = createConfig({
    NODE_ENV: 'test',
    PORT: '5050',
    GOOGLE_PLACES_API_KEY: 'test-key',
    GOOGLE_PLACES_MONTHLY_REQUEST_LIMIT: '800',
    GOOGLE_PLACES_DAILY_REQUEST_LIMIT: '4',
    GOOGLE_PLACES_REQUESTS_PER_MINUTE: '2',
    MAX_SEARCH_RESULTS: '25',
  });

  assert.equal(config.environment, 'test');
  assert.equal(config.port, 5050);
  assert.equal(config.googlePlacesApiKey, 'test-key');
  assert.equal(config.googlePlacesMonthlyRequestLimit, 800);
  assert.equal(config.googlePlacesDailyRequestLimit, 4);
  assert.equal(config.googlePlacesRequestsPerMinute, 2);
  assert.equal(config.maxSearchResults, 25);
});

test('readPositiveInteger rejects zero, negative, and non-integer values', () => {
  const options = { name: 'TEST_LIMIT', defaultValue: 1 };

  for (const value of ['0', '-1', '1.5', 'not-a-number']) {
    assert.throws(() => readPositiveInteger(value, options), /TEST_LIMIT/);
  }
});

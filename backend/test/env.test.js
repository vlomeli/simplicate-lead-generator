import assert from 'node:assert/strict';
import test from 'node:test';

import { createConfig, readAllowedOrigins, readBoolean, readPositiveInteger } from '../src/config/env.js';

test('createConfig uses documented safe defaults', () => {
  const config = createConfig({});

  assert.equal(config.port, 5000);
  assert.deepEqual(config.corsOrigins, ['http://localhost:5173']);
  assert.equal(config.googlePlacesMonthlyRequestLimit, 900);
  assert.equal(config.googlePlacesDailyRequestLimit, 5);
  assert.equal(config.googlePlacesRequestsPerMinute, 5);
  assert.equal(config.googlePlacesEnabled, false);
  assert.equal(config.websiteEmailDiscoveryEnabled, false);
  assert.equal(config.outreachJobRetentionHours, 168);
  assert.equal(config.maxSearchResults, 50);
  assert.equal(config.googlePlacesApiKey, '');
  assert.equal(config.supabaseUrl, '');
  assert.equal(config.supabaseServiceRoleKey, '');
});

test('createConfig accepts valid environment overrides', () => {
  const config = createConfig({
    NODE_ENV: 'test',
    PORT: '5050',
    CORS_ORIGIN: 'http://localhost:5173,https://leads.simplicate.example',
    GOOGLE_PLACES_API_KEY: 'test-key',
    GOOGLE_PLACES_ENABLED: 'true',
    WEBSITE_EMAIL_DISCOVERY_ENABLED: 'true',
    OUTREACH_JOB_RETENTION_HOURS: '24',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-secret-key',
    GOOGLE_PLACES_MONTHLY_REQUEST_LIMIT: '800',
    GOOGLE_PLACES_DAILY_REQUEST_LIMIT: '4',
    GOOGLE_PLACES_REQUESTS_PER_MINUTE: '2',
    MAX_SEARCH_RESULTS: '25',
  });

  assert.equal(config.environment, 'test');
  assert.equal(config.port, 5050);
  assert.deepEqual(config.corsOrigins, ['http://localhost:5173', 'https://leads.simplicate.example']);
  assert.equal(config.googlePlacesApiKey, 'test-key');
  assert.equal(config.googlePlacesEnabled, true);
  assert.equal(config.websiteEmailDiscoveryEnabled, true);
  assert.equal(config.outreachJobRetentionHours, 24);
  assert.equal(config.supabaseUrl, 'https://example.supabase.co');
  assert.equal(config.supabaseServiceRoleKey, 'test-secret-key');
  assert.equal(config.googlePlacesMonthlyRequestLimit, 800);
  assert.equal(config.googlePlacesDailyRequestLimit, 4);
  assert.equal(config.googlePlacesRequestsPerMinute, 2);
  assert.equal(config.maxSearchResults, 25);
});

test('readBoolean accepts only explicit boolean settings', () => {
  assert.equal(readBoolean('true', { name: 'TEST_FLAG', defaultValue: false }), true);
  assert.equal(readBoolean('false', { name: 'TEST_FLAG', defaultValue: true }), false);
  assert.throws(() => readBoolean('yes', { name: 'TEST_FLAG', defaultValue: false }), /TEST_FLAG/);
});

test('readAllowedOrigins accepts a comma-separated HTTP(S) allowlist', () => {
  const options = { name: 'CORS_ORIGIN', defaultValue: 'http://localhost:5173' };

  assert.deepEqual(
    readAllowedOrigins('http://localhost:5173/, https://leads.simplicate.example', options),
    ['http://localhost:5173', 'https://leads.simplicate.example'],
  );
  assert.throws(() => readAllowedOrigins('not-a-url', options), /CORS_ORIGIN/);
  assert.throws(() => readAllowedOrigins('ftp://example.com', options), /CORS_ORIGIN/);
});

test('readPositiveInteger rejects zero, negative, and non-integer values', () => {
  const options = { name: 'TEST_LIMIT', defaultValue: 1 };

  for (const value of ['0', '-1', '1.5', 'not-a-number']) {
    assert.throws(() => readPositiveInteger(value, options), /TEST_LIMIT/);
  }
});

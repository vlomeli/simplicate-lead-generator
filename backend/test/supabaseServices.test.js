import assert from 'node:assert/strict';
import test from 'node:test';

import { persistNewLeads } from '../src/services/leadRepository.js';
import { getPlacesUsage, reservePlacesUsage } from '../src/services/usageService.js';

const lead = {
  placeId: 'place-1', name: 'Example Shop', address: null, phone: null,
  website: null, rating: null, reviewCount: null, category: null,
  recipientEmail: null, emailStatus: 'not_sent',
};

test('a duplicate registry claim prevents a duplicate lead from being returned', async () => {
  let call;
  const client = {
    rpc: async (...args) => { call = args; return { data: false, error: null }; },
  };
  const result = await persistNewLeads(client, [lead]);
  assert.deepEqual(result, []);
  assert.deepEqual(call, ['persist_new_lead', { p_lead: lead }]);
});

test('a newly claimed registry entry is returned for export', async () => {
  const result = await persistNewLeads({
    rpc: async () => ({ data: true, error: null }),
  }, [lead]);
  assert.deepEqual(result, [lead]);
});

test('usage reservations call the atomic database RPC with configured limits', async () => {
  let call;
  const reservation = { reserved: true, daily_remaining: 4, monthly_remaining: 899 };
  const result = await reservePlacesUsage({
    rpc: async (...args) => { call = args; return { data: [reservation], error: null }; },
  }, { googlePlacesDailyRequestLimit: 5, googlePlacesMonthlyRequestLimit: 900 });
  assert.deepEqual(call, ['reserve_places_usage', { p_daily_limit: 5, p_monthly_limit: 900 }]);
  assert.equal(result, reservation);
});

test('a blocked atomic reservation is passed through without a provider call', async () => {
  const result = await reservePlacesUsage({
    rpc: async () => ({ data: [{ reserved: false, daily_remaining: 0, monthly_remaining: 899 }], error: null }),
  }, { googlePlacesDailyRequestLimit: 5, googlePlacesMonthlyRequestLimit: 900 });
  assert.equal(result.reserved, false);
  assert.equal(result.daily_remaining, 0);
});

test('fixture usage reports configured allowance and zero for missing counters', async () => {
  const requestedTables = [];
  const client = {
    from(table) {
      requestedTables.push(table);
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle: async () => ({ data: null, error: null }),
      };
    },
  };

  const usage = await getPlacesUsage(client, {
    googlePlacesDailyRequestLimit: 5,
    googlePlacesMonthlyRequestLimit: 900,
  }, new Date('2026-09-25T12:00:00.000Z'));

  assert.deepEqual(requestedTables, ['places_usage_daily', 'places_usage_monthly']);
  assert.equal(usage.fixtureMode, true);
  assert.deepEqual(usage.daily, { limit: 5, used: 0, remaining: 5 });
  assert.deepEqual(usage.monthly, {
    limit: 900, used: 0, remaining: 900, resetAt: '2026-10-01T00:00:00.000Z',
  });
});

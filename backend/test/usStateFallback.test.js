import assert from 'node:assert/strict';
import test from 'node:test';

import { getUsStateFallback } from '../src/utils/usStateFallback.js';

test('derives a US state fallback from a city-and-state location', () => {
  assert.equal(getUsStateFallback('Phoenix, AZ'), 'Arizona');
  assert.equal(getUsStateFallback('Las Vegas, Nevada'), 'Nevada');
  assert.equal(getUsStateFallback('New York, NY, USA'), 'New York');
});

test('does not broaden a state-only or unrecognized location', () => {
  assert.equal(getUsStateFallback('Arizona'), null);
  assert.equal(getUsStateFallback('Paris, France'), null);
});

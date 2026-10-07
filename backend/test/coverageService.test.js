import assert from 'node:assert/strict';
import test from 'node:test';

import { centerFromPlaces, coverageKey, tileAt } from '../src/services/coverageService.js';

test('coverage keys normalize spacing and capitalization', () => {
  assert.equal(coverageKey('  Roofing   Contractor '), 'roofing contractor');
});

test('the sampled-area spiral starts at center and visits different rectangles', () => {
  const center = { latitude: 29.76, longitude: -95.37 };
  const first = tileAt(0, center);
  const second = tileAt(1, center);
  assert.equal(first.x, 0);
  assert.equal(first.y, 0);
  assert.equal(second.x, 1);
  assert.notDeepEqual(first.rectangle, second.rectangle);
  assert.equal(tileAt(441, center), null);
});

test('market center uses provider coordinates without another request', () => {
  assert.deepEqual(centerFromPlaces([
    { location: { latitude: 30, longitude: -95 } },
    { location: { latitude: 32, longitude: -97 } },
  ]), { latitude: 31, longitude: -96 });
  assert.equal(centerFromPlaces([{ id: 'no-location' }]), null);
});

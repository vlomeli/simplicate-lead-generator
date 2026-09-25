import assert from 'node:assert/strict';
import test from 'node:test';

import { createPerUserSearchRateLimit } from '../src/middleware/searchRateLimit.js';

function createResponse() {
  return {
    headers: {}, statusCode: null, body: null,
    set(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  };
}

test('per-user search limiter blocks the sixth request in one minute', () => {
  const limiter = createPerUserSearchRateLimit({ limit: 5, now: () => 1_000 });

  for (let requestNumber = 0; requestNumber < 5; requestNumber += 1) {
    let continued = false;
    limiter({ user: { id: 'user-1' } }, createResponse(), () => { continued = true; });
    assert.equal(continued, true);
  }

  const response = createResponse();
  limiter({ user: { id: 'user-1' } }, response, () => assert.fail('blocked request must not continue'));

  assert.equal(response.statusCode, 429);
  assert.equal(response.headers['Retry-After'], '60');
  assert.match(response.body.error, /Search limit reached/);
});

test('per-user search limiter keeps users separate and expires the time window', () => {
  let time = 1_000;
  const limiter = createPerUserSearchRateLimit({ limit: 1, now: () => time });

  limiter({ user: { id: 'user-1' } }, createResponse(), () => {});
  let otherUserContinued = false;
  limiter({ user: { id: 'user-2' } }, createResponse(), () => { otherUserContinued = true; });
  assert.equal(otherUserContinued, true);

  time += 60_000;
  let expiredRequestContinued = false;
  limiter({ user: { id: 'user-1' } }, createResponse(), () => { expiredRequestContinued = true; });
  assert.equal(expiredRequestContinued, true);
});

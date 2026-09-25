import assert from 'node:assert/strict';
import test from 'node:test';

import { getBearerToken, requireAuthenticatedUser } from '../src/middleware/authenticate.js';

test('extracts a Bearer access token without accepting other schemes', () => {
  assert.equal(getBearerToken('Bearer token-value'), 'token-value');
  assert.equal(getBearerToken('bearer   token-value'), 'token-value');
  assert.equal(getBearerToken('Basic value'), null);
  assert.equal(getBearerToken(undefined), null);
});

test('auth middleware attaches the verified user', async () => {
  const request = { get: header => header === 'authorization' ? 'Bearer valid-token' : undefined };
  const response = fakeResponse();
  let called = false;
  await requireAuthenticatedUser(request, response, () => { called = true; }, {
    getConfigurationError: () => null,
    client: { auth: { getUser: async token => ({ data: { user: { id: 'user-1', email: 'user@example.com' } }, error: token === 'valid-token' ? null : new Error('bad') }) } },
  });
  assert.equal(called, true);
  assert.deepEqual(request.user, { id: 'user-1', email: 'user@example.com' });
});

test('auth middleware rejects missing or invalid access tokens', async () => {
  const request = { get: () => undefined };
  const response = fakeResponse();
  await requireAuthenticatedUser(request, response, () => assert.fail('next should not run'), {
    getConfigurationError: () => null,
  });
  assert.equal(response.statusCode, 401);
  assert.match(response.body.error, /Bearer/);
});

function fakeResponse() {
  return { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } };
}

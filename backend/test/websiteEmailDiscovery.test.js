import assert from 'node:assert/strict';
import test from 'node:test';
import { discoverPublicBusinessEmail } from '../src/services/websiteEmailDiscoveryService.js';
import { websiteEmailFixtures } from './fixtures/websiteEmailFixtures.js';

const websiteUrl = 'https://business.test';

for (const [name, html, expectedEmail] of [
  ['header text', websiteEmailFixtures.header, 'wecare@franklindownsfuneralhome.test'],
  ['footer text', websiteEmailFixtures.footer, 'hello@oakdaleplumbing.test'],
  ['form text', websiteEmailFixtures.form, 'careers@franklindownsfuneralhome.test'],
  ['mailto link', websiteEmailFixtures.mailto, 'office@northside.test'],
  ['HTML-encoded address', websiteEmailFixtures.encoded, 'hello@riverbank.test'],
]) {
  test(`discovers a public email in ${name}`, async () => {
    const result = await discoverPublicBusinessEmail(websiteUrl, {
      fetchPage: async (url) => ({ html, finalUrl: url }),
    });

    assert.deepEqual(result, {
      status: 'found',
      email: expectedEmail,
      sourceUrl: websiteUrl,
    });
  });
}

test('follows a same-site link identified by its visible contact label', async () => {
  const careersUrl = `${websiteUrl}/careers/careers`;
  const result = await discoverPublicBusinessEmail(websiteUrl, {
    fetchPage: async (url) => {
      if (url === websiteUrl) return { html: websiteEmailFixtures.homepageWithLabeledLink, finalUrl: url };
      if (url === careersUrl) return { html: websiteEmailFixtures.careersPage, finalUrl: url };
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  assert.deepEqual(result, {
    status: 'found',
    email: 'wecare@franklindownsfuneralhome.test',
    sourceUrl: careersUrl,
  });
});

test('reports not_found when a reachable website has no public email', async () => {
  const result = await discoverPublicBusinessEmail(websiteUrl, {
    fetchPage: async (url) => ({ html: websiteEmailFixtures.noEmail, finalUrl: url }),
  });

  assert.deepEqual(result, { status: 'not_found' });
});

test('reports failed when the website cannot be retrieved, such as HTTP 403', async () => {
  const result = await discoverPublicBusinessEmail(websiteUrl, {
    fetchPage: async () => {
      throw new Error('Website returned HTTP 403.');
    },
  });

  assert.deepEqual(result, { status: 'failed' });
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { diagnosePublicWebsite, discoverPublicBusinessEmail, fetchPublicHtml } from '../src/services/websiteEmailDiscoveryService.js';
import { websiteEmailFixtures } from './fixtures/websiteEmailFixtures.js';

const websiteUrl = 'https://business.test';

for (const [name, html, expectedEmail] of [
  ['header text', websiteEmailFixtures.header, 'wecare@franklindownsfuneralhome.test'],
  ['footer text', websiteEmailFixtures.footer, 'hello@oakdaleplumbing.test'],
  ['form text', websiteEmailFixtures.form, 'careers@franklindownsfuneralhome.test'],
  ['mailto link', websiteEmailFixtures.mailto, 'office@northside.test'],
  ['mailto link ahead of script noise', websiteEmailFixtures.scriptNoiseWithMailto, 'randcshop@gmail.com'],
  ['HTML-encoded address', websiteEmailFixtures.encoded, 'hello@riverbank.test'],
]) {
  test(`discovers a public email in ${name}`, async () => {
    const result = await discoverPublicBusinessEmail(websiteUrl, {
      fetchPage: async (url) => {
        if (url === websiteUrl) return { html, finalUrl: url };
        throw new Error(`Unexpected URL: ${url}`);
      },
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

test('checks the standard contact routes when the homepage does not expose their links', async () => {
  const contactUrl = `${websiteUrl}/contact/`;
  const contactUsUrl = `${websiteUrl}/contact-us/`;
  const fetchedUrls = [];
  const result = await discoverPublicBusinessEmail(websiteUrl, {
    fetchPage: async (url) => {
      fetchedUrls.push(url);
      if (url === websiteUrl) return { html: websiteEmailFixtures.noEmail, finalUrl: url };
      if (url === contactUrl) return { html: websiteEmailFixtures.contactPageWithMailtoEmail, finalUrl: url };
      if (url === contactUsUrl) return { html: websiteEmailFixtures.contactUsPageWithVisibleEmail, finalUrl: url };
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  assert.deepEqual(fetchedUrls, [websiteUrl, contactUrl, contactUsUrl]);
  assert.deepEqual(result, {
    status: 'found',
    email: 'info@blueocean.test',
    sourceUrl: contactUrl,
  });
});

test('continues past a rejected homepage placeholder and selects a contact-page domain match', async () => {
  const businessUrl = 'https://mrbucketcc.com/';
  const contactUrl = 'https://mrbucketcc.com/contact/';
  const result = await discoverPublicBusinessEmail(businessUrl, {
    fetchPage: async (url) => {
      if (url === businessUrl) return { html: websiteEmailFixtures.homepageWithTemplateAndContact, finalUrl: url };
      if (url === contactUrl) return { html: websiteEmailFixtures.contactPageWithDomainEmail, finalUrl: url };
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  assert.deepEqual(result, {
    status: 'found',
    email: 'info@mrbucketcc.com',
    sourceUrl: contactUrl,
  });
});

test('reports not_found when a reachable website has no public email', async () => {
  const result = await discoverPublicBusinessEmail(websiteUrl, {
    fetchPage: async (url) => ({ html: websiteEmailFixtures.noEmail, finalUrl: url }),
  });

  assert.deepEqual(result, { status: 'not_found' });
});

test('rejects Wix technical addresses as business contacts', async () => {
  const result = await discoverPublicBusinessEmail(websiteUrl, {
    fetchPage: async (url) => ({ html: websiteEmailFixtures.wixTechnicalEmail, finalUrl: url }),
  });

  assert.deepEqual(result, { status: 'not_found' });
});

test('rejects the confirmed placeholder email address', async () => {
  const result = await discoverPublicBusinessEmail(websiteUrl, {
    fetchPage: async (url) => ({ html: websiteEmailFixtures.placeholderEmail, finalUrl: url }),
  });

  assert.deepEqual(result, { status: 'not_found' });
});

test('ignores example addresses in form-field attributes', async () => {
  const result = await discoverPublicBusinessEmail(websiteUrl, {
    fetchPage: async (url) => ({ html: websiteEmailFixtures.formFieldPlaceholder, finalUrl: url }),
  });

  assert.deepEqual(result, { status: 'not_found' });
});

test('reports failed when the website cannot be retrieved, such as HTTP 403', async () => {
  const result = await discoverPublicBusinessEmail(websiteUrl, {
    fetchPage: async () => {
      throw new Error('Website returned HTTP 403.');
    },
  });

  assert.deepEqual(result, { status: 'failed', failureCode: 'http_403' });
});

test('uses ordinary HTML request headers without making a real website request', async () => {
  let requestOptions;
  const result = await fetchPublicHtml(websiteUrl, {
    validateUrl: async value => value,
    fetch: async (_url, options) => {
      requestOptions = options;
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: async () => '<p>hello</p>',
      };
    },
  });

  assert.equal(result.html, '<p>hello</p>');
  assert.equal(requestOptions.headers['Accept-Language'], 'en-US,en;q=0.9');
  assert.match(requestOptions.headers['User-Agent'], /SimplicateLeadGenerator/);
});

test('reports a safe network code from the one-page diagnostic', async () => {
  const fetchFailure = new TypeError('fetch failed');
  fetchFailure.cause = { code: 'ECONNRESET' };
  const result = await diagnosePublicWebsite(websiteUrl, {
    validateUrl: async value => value,
    fetch: async () => { throw fetchFailure; },
  });

  assert.deepEqual(result, { status: 'failed', failureCode: 'network_econnreset' });
});

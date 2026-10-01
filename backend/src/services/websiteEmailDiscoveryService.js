import dns from 'node:dns/promises';

const maxPagesPerWebsite = 3;
const maxHtmlBytes = 1_000_000;
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

// This only checks normal public HTML pages and never guesses an address.
// It is disabled by default through WEBSITE_EMAIL_DISCOVERY_ENABLED.
export async function discoverPublicBusinessEmail(website, options = {}) {
  if (!website) return { status: 'no_website' };
  const fetchPage = options.fetchPage ?? fetchPublicHtml;
  const checked = new Set();
  const pending = [website];
  let successfulPages = 0;

  while (pending.length && checked.size < maxPagesPerWebsite) {
    const url = pending.shift();
    if (checked.has(url)) continue;
    checked.add(url);

    try {
      const { html, finalUrl } = await fetchPage(url, options);
      successfulPages += 1;
      const email = findPublicEmail(html);
      if (email) return { status: 'found', email, sourceUrl: finalUrl };
      for (const link of findContactLinks(html, finalUrl)) {
        if (!checked.has(link) && !pending.includes(link) && pending.length + checked.size < maxPagesPerWebsite) pending.push(link);
      }
    } catch {
      // A failed individual page should not prevent checking another public
      // contact/about page on the same website.
    }
  }

  return { status: successfulPages ? 'not_found' : 'failed' };
}

export async function fetchPublicHtml(initialUrl, { fetch: fetchRequest = globalThis.fetch } = {}) {
  let url = await assertPublicHttpUrl(initialUrl);
  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    const response = await fetchRequest(url, {
      headers: { Accept: 'text/html,application/xhtml+xml' },
      redirect: 'manual',
      signal: AbortSignal.timeout(8_000),
    });
    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      url = await assertPublicHttpUrl(new URL(response.headers.get('location'), url).toString());
      continue;
    }
    if (!response.ok) throw new Error(`Website returned HTTP ${response.status}.`);
    if (!response.headers.get('content-type')?.toLowerCase().includes('text/html')) throw new Error('Website did not return HTML.');
    return { html: await readTextLimited(response), finalUrl: url };
  }
  throw new Error('Website redirected too many times.');
}

async function assertPublicHttpUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Only public HTTP(S) URLs are allowed.');
  const addresses = await dns.lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw new Error('Website does not resolve to a public address.');
  return url.toString();
}

function isPrivateAddress(address) {
  const value = address.toLowerCase();
  return value === '::1' || value.startsWith('fe80:') || value.startsWith('fc') || value.startsWith('fd')
    || /^10\./.test(value) || /^127\./.test(value) || /^169\.254\./.test(value)
    || /^192\.168\./.test(value) || /^172\.(1[6-9]|2\d|3[01])\./.test(value);
}

async function readTextLimited(response) {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxHtmlBytes) throw new Error('Website response is too large.');
  const reader = response.body?.getReader();
  if (!reader) return response.text();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxHtmlBytes) throw new Error('Website response is too large.');
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

function findPublicEmail(html) {
  const matches = normalizeEmailMarkup(html).match(emailPattern) ?? [];
  return matches.map(value => value.replace(/[),.;:]+$/, '')).find(value => !value.endsWith('@example.com')) ?? null;
}

function findContactLinks(html, pageUrl) {
  const links = [];
  const anchorPattern = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorPattern.exec(html))) {
    try {
      const url = new URL(match[1], pageUrl);
      const linkText = stripHtml(match[2]);
      const looksHelpful = /contact|about|team|support|get\s+in\s+touch|email\s+us|reach\s+us/i.test(url.pathname)
        || /contact|about|team|support|get\s+in\s+touch|email\s+us|reach\s+us/i.test(linkText);
      if (url.origin === new URL(pageUrl).origin && looksHelpful) links.push(url.toString());
    } catch {}
  }
  return links;
}

function normalizeEmailMarkup(html) {
  return html
    .replace(/&#(?:x0*40|0*64);?/gi, '@')
    .replace(/&commat;?/gi, '@')
    .replace(/&#(?:x0*2e|0*46);?/gi, '.')
    .replace(/&period;?/gi, '.');
}

function stripHtml(value) {
  return normalizeEmailMarkup(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

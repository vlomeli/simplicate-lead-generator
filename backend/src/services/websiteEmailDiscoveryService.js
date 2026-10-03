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
  // Keep website discovery deliberately bounded to the Google-provided
  // landing page plus two likely contact pages.
  const pending = [website];
  const candidates = [];
  let successfulPages = 0;
  let failureCode = null;

  while (pending.length && checked.size < maxPagesPerWebsite) {
    const url = pending.shift();
    if (checked.has(url)) continue;
    checked.add(url);

    try {
      const { html, finalUrl } = await fetchPage(url, options);
      successfulPages += 1;
      candidates.push(...findPublicEmailCandidates(html, finalUrl, website));
      const contactPages = [
        ...findContactLinks(html, finalUrl),
        ...getPreferredContactUrls(website),
      ];
      for (const link of contactPages) {
        if (!checked.has(link) && !pending.includes(link) && pending.length + checked.size < maxPagesPerWebsite) pending.push(link);
      }
    } catch (error) {
      failureCode ??= getFailureCode(error);
      // A failed individual page should not prevent checking another public
      // contact/about page on the same website.
    }
  }

  const bestCandidate = selectBestCandidate(candidates);
  if (bestCandidate) return { status: 'found', email: bestCandidate.email, sourceUrl: bestCandidate.sourceUrl };
  return successfulPages ? { status: 'not_found' } : { status: 'failed', failureCode: failureCode ?? 'fetch_failed' };
}

export async function fetchPublicHtml(initialUrl, { fetch: fetchRequest = globalThis.fetch, validateUrl = assertPublicHttpUrl } = {}) {
  let url = await validateUrl(initialUrl);
  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    const response = await fetchRequest(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'Mozilla/5.0 (compatible; SimplicateLeadGenerator/1.0; public-business-email-discovery)',
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(8_000),
    });
    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      url = await validateUrl(new URL(response.headers.get('location'), url).toString());
      continue;
    }
    if (!response.ok) throw new Error(`Website returned HTTP ${response.status}.`);
    if (!response.headers.get('content-type')?.toLowerCase().includes('text/html')) throw new Error('Website did not return HTML.');
    return { html: await readTextLimited(response), finalUrl: url };
  }
  throw new Error('Website redirected too many times.');
}

// Developer-only diagnostic helper. It makes one homepage request and keeps
// the result in the terminal; it does not call Google or write to Supabase.
export async function diagnosePublicWebsite(website, options = {}) {
  try {
    const { html, finalUrl } = await fetchPublicHtml(website, options);
    return {
      status: 'fetched',
      finalUrl,
      htmlBytes: Buffer.byteLength(html),
      email: selectBestCandidate(findPublicEmailCandidates(html, finalUrl, finalUrl))?.email ?? null,
    };
  } catch (error) {
    return { status: 'failed', failureCode: getFailureCode(error) };
  }
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

function findPublicEmailCandidates(html, sourceUrl, website) {
  const normalizedHtml = normalizeEmailMarkup(html);
  const mailtoEmails = findMailtoEmails(normalizedHtml);
  const visiblePageEmails = findEmailMatches(extractVisibleText(normalizedHtml));
  return [
    ...mailtoEmails.map(email => createEmailCandidate(email, sourceUrl, website, 'mailto')),
    ...visiblePageEmails.map(email => createEmailCandidate(email, sourceUrl, website, 'visible')),
  ].filter(Boolean);
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

function getPreferredContactUrls(website) {
  try {
    const site = new URL(website);
    return ['/contact/', '/contact-us/'].map(path => new URL(path, site.origin).toString());
  } catch {
    return [];
  }
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

function findMailtoEmails(html) {
  const emails = [];
  const mailtoPattern = /<a\b[^>]*href\s*=\s*["']mailto:([^"'?#\s]+)[^"']*["'][^>]*>/gi;
  let match;
  while ((match = mailtoPattern.exec(html))) {
    try {
      emails.push(...findEmailMatches(decodeURIComponent(match[1])));
    } catch {
      emails.push(...findEmailMatches(match[1]));
    }
  }
  return emails;
}

function findEmailMatches(value) {
  return (value.match(emailPattern) ?? []).map(email => email.replace(/[),.;:]+$/, ''));
}

function removeNonVisibleMarkup(html) {
  return html.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');
}

function extractVisibleText(html) {
  return removeNonVisibleMarkup(html).replace(/<[^>]+>/g, ' ');
}

function isPublicBusinessEmail(email) {
  const normalized = email.toLowerCase();
  const domain = normalized.split('@')[1];
  return normalized !== 'mymail@mailservice.com'
    && !normalized.endsWith('@example.com')
    && domain !== 'wixpress.com'
    && !domain?.endsWith('.wixpress.com');
}

function createEmailCandidate(email, sourceUrl, website, sourceType) {
  if (!isPublicBusinessEmail(email)) return null;
  const score = (sourceType === 'mailto' ? 30 : 10)
    + (isContactLikeUrl(sourceUrl) ? 30 : 0)
    + (emailMatchesWebsiteDomain(email, website) ? 100 : 0);
  return { email, sourceUrl, score };
}

function selectBestCandidate(candidates) {
  const uniqueCandidates = new Map();
  for (const candidate of candidates) {
    const key = candidate.email.toLowerCase();
    if (!uniqueCandidates.has(key) || uniqueCandidates.get(key).score < candidate.score) uniqueCandidates.set(key, candidate);
  }
  return [...uniqueCandidates.values()].sort((left, right) => right.score - left.score)[0] ?? null;
}

function isContactLikeUrl(value) {
  try {
    return /contact|about|team|support|get-in-touch|find-us/i.test(new URL(value).pathname);
  } catch {
    return false;
  }
}

function emailMatchesWebsiteDomain(email, website) {
  try {
    const emailDomain = email.toLowerCase().split('@')[1];
    const websiteHost = new URL(website).hostname.toLowerCase().replace(/^www\./, '');
    return emailDomain === websiteHost || websiteHost.endsWith(`.${emailDomain}`);
  } catch {
    return false;
  }
}

function getFailureCode(error) {
  const message = error instanceof Error ? error.message : '';
  const networkCode = typeof error?.cause?.code === 'string' ? error.cause.code.toLowerCase() : null;
  if (networkCode) return `network_${networkCode}`;
  if (/HTTP 403/.test(message)) return 'http_403';
  if (/HTTP 401/.test(message)) return 'http_401';
  if (/HTTP 429/.test(message)) return 'http_429';
  if (/timed out|timeout/i.test(message) || error?.name === 'TimeoutError') return 'timeout';
  if (/did not return HTML/.test(message)) return 'non_html';
  if (/response is too large/.test(message)) return 'response_too_large';
  if (/redirected too many times/.test(message)) return 'too_many_redirects';
  if (/Only public HTTP\(S\)|does not resolve to a public address/.test(message)) return 'unsafe_url';
  return 'fetch_failed';
}

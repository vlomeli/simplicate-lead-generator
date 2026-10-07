import { config } from '../config/env.js';
import { searchFixturePlaces } from './fixturePlacesService.js';
import { discoverFixturePublicEmail } from './fixtureEmailDiscoveryService.js';
import { GooglePlacesUsageLimitError, searchGooglePlacesPage } from './googlePlacesService.js';
import {
  addOutreachResult,
  claimPlaceId,
  createOutreachJob,
  removeExpiredOutreachJobs,
  updateOutreachJob,
  getCoverageMarket,
  reserveCoverageTile,
  recordCoverageTile,
  ensureCoverageMarket,
} from './outreachRepository.js';
import { discoverPublicBusinessEmail } from './websiteEmailDiscoveryService.js';
import { normalizeLead } from '../utils/leadNormalizer.js';
import { getUsStateFallback } from '../utils/usStateFallback.js';
import { centerFromPlaces, coverageKey, tileAt } from './coverageService.js';

export const maxOutreachBusinesses = 50;
export const websiteCheckConcurrency = 3;
export const maxOutreachGoogleRequests = 6;

export async function startOutreachJob(request, options = {}) {
  const activeConfig = options.config ?? config;
  const client = options.client;
  const source = activeConfig.googlePlacesEnabled ? 'google_places' : 'fixture';
  const retentionHours = activeConfig.outreachJobRetentionHours;
  const expiresAt = new Date(Date.now() + retentionHours * 60 * 60 * 1_000).toISOString();

  await (options.removeExpired ?? removeExpiredOutreachJobs)(client);
  const job = await (options.createJob ?? createOutreachJob)(client, {
    requested_by: request.userId,
    query: request.query.trim(),
    location: request.location.trim(),
    target_count: request.targetCount,
    include_nearby: request.includeNearby === true,
    source,
    expires_at: expiresAt,
  });

  const execute = options.execute ?? executeOutreachJob;
  setImmediate(() => {
    execute(job, { ...options, client, config: activeConfig }).catch(() => {});
  });
  return job;
}

export async function executeOutreachJob(job, options = {}) {
  const activeConfig = options.config ?? config;
  const client = options.client;
  const updateJob = options.updateJob ?? updateOutreachJob;
  const addResult = options.addResult ?? addOutreachResult;
  const claim = options.claimPlaceId ?? claimPlaceId;
  const searchPlaces = options.searchPlaces ?? searchFixturePlaces;
  const searchPage = options.searchPage ?? (request => searchGooglePlacesPage(request, { client, config: activeConfig }));
  const checkEmail = options.checkEmail ?? createEmailChecker(job.source, activeConfig, options);

  try {
    await updateJob(client, job.id, { status: 'running' });
    let websitesChecked = 0;
    let emailsFound = 0;
    let savedCount = 0;
    let primaryBusinessesFound = 0;
    let nearbyBusinessesFound = 0;

    const processPlaces = async (places, source) => {
      const leads = places.map(normalizeLead).slice(0, Math.max(job.target_count - savedCount, 0));
      let duplicates = 0;
      let nextLeadIndex = 0;
      let persistResult = Promise.resolve();

      const saveOutcome = (lead, emailResult) => {
        persistResult = persistResult.then(async () => {
          if (lead.website && emailResult.status !== 'skipped') websitesChecked += 1;
          if (emailResult.status === 'found') emailsFound += 1;
          savedCount += 1;
          if (source === 'primary') primaryBusinessesFound += 1;
          else nearbyBusinessesFound += 1;

          await addResult(client, toResultRow(job.id, lead, emailResult));
          await updateJob(client, job.id, {
            businesses_found: savedCount,
            primary_businesses_found: primaryBusinessesFound,
            nearby_businesses_found: nearbyBusinessesFound,
            websites_checked: websitesChecked,
            emails_found: emailsFound,
          });
        });
        return persistResult;
      };

      const worker = async () => {
        while (nextLeadIndex < leads.length) {
          const lead = leads[nextLeadIndex];
          nextLeadIndex += 1;
          const isNew = await claim(client, lead.placeId);
          if (!isNew) { duplicates += 1; continue; }

          const emailResult = await checkEmail(lead);
          await saveOutcome(lead, emailResult);
        }
      };

      const workerCount = Math.min(websiteCheckConcurrency, leads.length);
      await Promise.all(Array.from({ length: workerCount }, worker));
      await persistResult;
      return { duplicates, newBusinesses: leads.length - duplicates };
    };

    if (job.source === 'fixture') {
      await processPlaces(await searchPlaces({
        query: job.query, location: job.location, maxResults: job.target_count, maxPages: 3,
      }), 'primary');
    } else {
      const queryKey = coverageKey(job.query);
      const locationKey = coverageKey(job.location);
      const readMarket = options.getCoverageMarket ?? getCoverageMarket;
      const reserveTile = options.reserveCoverageTile ?? reserveCoverageTile;
      const recordTile = options.recordCoverageTile ?? recordCoverageTile;
      const ensureMarket = options.ensureCoverageMarket ?? ensureCoverageMarket;
      let market = await readMarket(client, queryKey, locationKey);
      let requestsUsed = 0;
      let cityRawResults = 0;

      if (!market) {
        const firstPage = await searchPage({ query: job.query, location: job.location, maxResults: 20 });
        requestsUsed += 1;
        cityRawResults += firstPage.places.length;
        await processPlaces(firstPage.places, 'primary');
        const center = centerFromPlaces(firstPage.places);
        if (center) {
          await ensureMarket(client, queryKey, locationKey, center);
          market = { center_lat: center.latitude, center_lng: center.longitude };
        }
      }

      // Sparse markets reserve the final request for regional fallback;
      // dense markets spend all six requests on fresh city areas.
      while (market && savedCount < job.target_count && requestsUsed < maxOutreachGoogleRequests
          && !(job.include_nearby && cityRawResults < 10 && requestsUsed >= 5)) {
        const reservation = await reserveTile(client, queryKey, locationKey, {
          latitude: market.center_lat, longitude: market.center_lng,
        });
        if (!reservation) break;
        const tile = tileAt(reservation.tile_index, {
          latitude: reservation.market_lat, longitude: reservation.market_lng,
        });
        const page = await searchPage({
          query: job.query, location: job.location, maxResults: 20, rectangle: tile.rectangle,
        });
        requestsUsed += 1;
        cityRawResults += page.places.length;
        const outcome = await processPlaces(page.places, 'primary');
        await recordTile(client, {
          query_key: queryKey, location_key: locationKey, tile_index: tile.index,
          center_lat: tile.latitude, center_lng: tile.longitude,
          raw_results: page.places.length, duplicates: outcome.duplicates,
          new_businesses: outcome.newBusinesses,
        });
      }

      if (job.include_nearby && savedCount < job.target_count && requestsUsed < maxOutreachGoogleRequests
          && (!market || cityRawResults < 10)) {
        const regionalFallback = getUsStateFallback(job.location);
        if (regionalFallback) {
          let pageToken = null;
          do {
            const page = await searchPage({
              query: job.query, location: regionalFallback, maxResults: 20, pageToken,
            });
            requestsUsed += 1;
            await processPlaces(page.places, 'nearby');
            pageToken = page.nextPageToken;
          } while (pageToken && savedCount < job.target_count && requestsUsed < maxOutreachGoogleRequests);
        }
      }
    }

    await updateJob(client, job.id, {
      status: 'completed',
      businesses_found: savedCount,
      primary_businesses_found: primaryBusinessesFound,
      nearby_businesses_found: nearbyBusinessesFound,
      websites_checked: websitesChecked,
      emails_found: emailsFound,
      completed_at: new Date().toISOString(),
    });
  } catch (error) {
    await updateJob(client, job.id, {
      status: 'failed',
      failure_code: getOutreachFailureCode(error),
      completed_at: new Date().toISOString(),
    });
  }
}

function getOutreachFailureCode(error) {
  if (error instanceof GooglePlacesUsageLimitError) {
    return error.limitType === 'monthly'
      ? 'google_places_monthly_limit_reached'
      : 'google_places_daily_limit_reached';
  }
  return 'outreach_job_failed';
}

function createEmailChecker(source, activeConfig, options) {
  if (source === 'fixture') return discoverFixturePublicEmail;
  if (!activeConfig.websiteEmailDiscoveryEnabled) {
    return async lead => lead.website ? { status: 'skipped' } : { status: 'no_website' };
  }
  const discoverWebsiteEmail = options.discoverWebsiteEmail ?? discoverPublicBusinessEmail;
  return lead => discoverWebsiteEmail(lead.website);
}

function toResultRow(jobId, lead, emailResult) {
  return {
    job_id: jobId,
    place_id: lead.placeId,
    business_name: lead.name,
    address: lead.address,
    phone: lead.phone,
    website: lead.website,
    rating: lead.rating,
    review_count: lead.reviewCount,
    category: lead.category,
    recipient_email: emailResult.email ?? null,
    email_source_url: emailResult.sourceUrl ?? null,
    email_status: emailResult.status,
    email_checked_at: emailResult.status === 'skipped' ? null : new Date().toISOString(),
    failure_code: emailResult.failureCode ?? null,
  };
}

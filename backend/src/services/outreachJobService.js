import { config } from '../config/env.js';
import { searchFixturePlaces } from './fixturePlacesService.js';
import { discoverFixturePublicEmail } from './fixtureEmailDiscoveryService.js';
import { searchGooglePlacesBatch } from './googlePlacesService.js';
import {
  addOutreachResult,
  claimPlaceId,
  createOutreachJob,
  removeExpiredOutreachJobs,
  updateOutreachJob,
} from './outreachRepository.js';
import { discoverPublicBusinessEmail } from './websiteEmailDiscoveryService.js';
import { normalizeLead } from '../utils/leadNormalizer.js';

export const maxOutreachBusinesses = 50;

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
  const searchPlaces = options.searchPlaces ?? (job.source === 'google_places'
    ? request => searchGooglePlacesBatch(request, { client, config: activeConfig })
    : searchFixturePlaces);
  const checkEmail = options.checkEmail ?? createEmailChecker(job.source, activeConfig);

  try {
    await updateJob(client, job.id, { status: 'running' });
    const rawPlaces = await searchPlaces({ query: job.query, location: job.location, maxResults: job.target_count });
    const leads = rawPlaces.map(normalizeLead);
    let websitesChecked = 0;
    let emailsFound = 0;
    let savedCount = 0;

    await updateJob(client, job.id, { businesses_found: leads.length });
    for (const lead of leads) {
      const isNew = await claim(client, lead.placeId);
      if (!isNew) continue;

      const emailResult = await checkEmail(lead);
      if (lead.website && emailResult.status !== 'skipped') websitesChecked += 1;
      if (emailResult.status === 'found') emailsFound += 1;
      savedCount += 1;

      await addResult(client, toResultRow(job.id, lead, emailResult));
      await updateJob(client, job.id, { websites_checked: websitesChecked, emails_found: emailsFound });
    }

    await updateJob(client, job.id, {
      status: 'completed',
      businesses_found: savedCount,
      websites_checked: websitesChecked,
      emails_found: emailsFound,
      completed_at: new Date().toISOString(),
    });
  } catch {
    await updateJob(client, job.id, {
      status: 'failed',
      failure_code: 'outreach_job_failed',
      completed_at: new Date().toISOString(),
    });
  }
}

function createEmailChecker(source, activeConfig) {
  if (source === 'fixture') return discoverFixturePublicEmail;
  if (!activeConfig.websiteEmailDiscoveryEnabled) {
    return async lead => lead.website ? { status: 'skipped' } : { status: 'no_website' };
  }
  return discoverPublicBusinessEmail;
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
    failure_code: emailResult.status === 'failed' ? 'website_check_failed' : null,
  };
}

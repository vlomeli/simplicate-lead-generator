import { config } from '../config/env.js';
import { createFullResultsCsv, createOutreachCsv } from '../services/outreachCsvService.js';
import { maxOutreachBusinesses, startOutreachJob } from '../services/outreachJobService.js';
import { getOutreachJob, listRecentOutreachJobs as listRecentJobs } from '../services/outreachRepository.js';
import { createSupabaseClient } from '../services/supabaseClient.js';

export async function createOutreachJob(request, response) {
  const validationError = validateOutreachRequest(request.body);
  if (validationError) return response.status(400).json({ error: validationError });

  try {
    const job = await startOutreachJob({ ...request.body, userId: request.user.id }, {
      client: createSupabaseClient(), config,
    });
    response.status(202).json(toJobResponse(job));
  } catch {
    response.status(500).json({ error: 'Unable to start the outreach list.' });
  }
}

export async function readOutreachJob(request, response) {
  try {
    const job = await getOutreachJob(createSupabaseClient(), request.params.jobId, request.user.id);
    if (!job) return response.status(404).json({ error: 'Outreach list not found or has expired.' });
    return response.status(200).json(toJobResponse(job));
  } catch {
    return response.status(500).json({ error: 'Unable to read the outreach list.' });
  }
}

export async function listRecentOutreachJobs(request, response) {
  try {
    const jobs = await listRecentJobs(createSupabaseClient(), request.user.id);
    return response.status(200).json(jobs.map(toJobResponse));
  } catch {
    return response.status(500).json({ error: 'Unable to read recent outreach lists.' });
  }
}

export async function downloadOutreachCsv(request, response) {
  const type = request.query.type === 'full' ? 'full' : request.query.type === 'outreach' ? 'outreach' : null;
  if (!type) return response.status(400).json({ error: 'type must be outreach or full.' });
  try {
    const job = await getOutreachJob(createSupabaseClient(), request.params.jobId, request.user.id);
    if (!job) return response.status(404).json({ error: 'Outreach list not found or has expired.' });
    if (job.status !== 'completed') return response.status(409).json({ error: 'The outreach list is not complete yet.' });
    const csv = type === 'outreach' ? createOutreachCsv(job.results) : createFullResultsCsv(job.results);
    const date = new Date(job.created_at).toISOString().slice(0, 10);
    const filename = `${type}-list-${date}-${job.id.slice(0, 8)}.csv`;
    response.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    });
    return response.status(200).send(csv);
  } catch {
    return response.status(500).json({ error: 'Unable to create the CSV export.' });
  }
}

export function validateOutreachRequest(body) {
  if (typeof body?.query !== 'string' || body.query.trim() === '') return 'query must be a non-empty string.';
  if (typeof body?.location !== 'string' || body.location.trim() === '') return 'location must be a non-empty string.';
  if (!Number.isInteger(body?.targetCount) || body.targetCount < 1 || body.targetCount > maxOutreachBusinesses) {
    return `targetCount must be a whole number between 1 and ${maxOutreachBusinesses}.`;
  }
  if (body.includeNearby !== undefined && typeof body.includeNearby !== 'boolean') return 'includeNearby must be true or false.';
  return null;
}

function toJobResponse(job) {
  return {
    id: job.id,
    query: job.query,
    location: job.location,
    targetCount: job.target_count,
    includeNearby: job.include_nearby,
    source: job.source,
    status: job.status,
    failureCode: job.failure_code,
    businessesFound: job.businesses_found,
    websitesChecked: job.websites_checked,
    emailsFound: job.emails_found,
    primaryBusinessesFound: job.primary_businesses_found,
    nearbyBusinessesFound: job.nearby_businesses_found,
    createdAt: job.created_at,
    completedAt: job.completed_at,
    expiresAt: job.expires_at,
    results: (job.results ?? []).map(result => ({
      placeId: result.place_id,
      name: result.business_name,
      address: result.address,
      phone: result.phone,
      website: result.website,
      rating: result.rating,
      reviews: result.review_count,
      category: result.category,
      email: result.recipient_email,
      emailStatus: result.email_status,
      emailSourceUrl: result.email_source_url,
      emailFailureCode: result.failure_code,
    })),
  };
}

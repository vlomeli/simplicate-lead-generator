function databaseError(error, operation) {
  const wrapped = new Error(`Unable to ${operation}.`);
  wrapped.cause = error;
  return wrapped;
}

export async function removeExpiredOutreachJobs(client) {
  const { error } = await client.from('outreach_jobs').delete().lt('expires_at', new Date().toISOString());
  if (error) throw databaseError(error, 'remove expired outreach lists');
}

export async function createOutreachJob(client, job) {
  const { data, error } = await client.from('outreach_jobs').insert(job).select().single();
  if (error) throw databaseError(error, 'create the outreach list');
  return data;
}

export async function updateOutreachJob(client, jobId, values) {
  const { data, error } = await client.from('outreach_jobs').update(values).eq('id', jobId).select().single();
  if (error) throw databaseError(error, 'update the outreach list');
  return data;
}

export async function claimPlaceId(client, placeId) {
  const { data, error } = await client.rpc('claim_place_id', { p_place_id: placeId });
  if (error) throw databaseError(error, 'claim the business ID');
  return data;
}

export async function addOutreachResult(client, result) {
  const { error } = await client.from('outreach_job_results').insert(result);
  if (error) throw databaseError(error, 'save the outreach result');
}

export async function getOutreachJob(client, jobId, userId) {
  const { data: job, error: jobError } = await client.from('outreach_jobs')
    .select().eq('id', jobId).eq('requested_by', userId).gt('expires_at', new Date().toISOString()).maybeSingle();
  if (jobError) throw databaseError(jobError, 'read the outreach list');
  if (!job) return null;
  const { data: results, error: resultsError } = await client.from('outreach_job_results')
    .select().eq('job_id', jobId).order('created_at');
  if (resultsError) throw databaseError(resultsError, 'read outreach results');
  return { ...job, results };
}

export async function listRecentOutreachJobs(client, userId, limit = 10) {
  const { data, error } = await client.from('outreach_jobs')
    .select()
    .eq('requested_by', userId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw databaseError(error, 'list recent outreach lists');
  return data;
}

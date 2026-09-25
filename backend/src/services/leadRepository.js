function databaseError(error, operation) {
  const wrapped = new Error(`Unable to ${operation}.`);
  wrapped.cause = error;
  return wrapped;
}

// The database RPC claims the registry entry and inserts the lead in one
// transaction, so a failed lead insert can never leave a false duplicate claim.
export async function persistNewLeads(client, leads) {
  const newLeads = [];

  for (const lead of leads) {
    const { data: inserted, error } = await client.rpc('persist_new_lead', { p_lead: lead });
    if (error) throw databaseError(error, 'claim and save the lead');
    if (!inserted) continue;
    newLeads.push(lead);
  }

  return newLeads;
}

export async function recordLeadSearch(client, { userId, searchRequest, status, failureCode = null }) {
  const { error } = await client.from('lead_searches').insert({
    requested_by: userId,
    query: searchRequest.query,
    location: searchRequest.location,
    max_results: searchRequest.maxResults,
    provider_requests: 0,
    status,
    failure_code: failureCode,
  });
  if (error) throw databaseError(error, 'record the search');
}

export async function recordLeadExport(client, { userId, exportInfo }) {
  const { error } = await client.from('lead_exports').insert({
    generated_by: userId,
    filename: exportInfo.filename,
    lead_count: exportInfo.leadCount,
  });
  if (error) throw databaseError(error, 'record the export');
}

// `collectedPlaceIds` intentionally lives for the lifetime of this Node process.
// A later Supabase-backed phase will replace it with the permanent registry.
export function removeDuplicateLeads(leads, collectedPlaceIds) {
  if (!(collectedPlaceIds instanceof Set)) {
    throw new TypeError('collectedPlaceIds must be a Set.');
  }

  const newLeads = [];

  for (const lead of leads) {
    if (!collectedPlaceIds.has(lead.placeId)) {
      collectedPlaceIds.add(lead.placeId);
      newLeads.push(lead);
    }
  }

  return newLeads;
}

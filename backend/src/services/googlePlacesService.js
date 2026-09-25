// Live Google access is deliberately disabled during the fixture-only phase.
// This module must remain network-free until the owner explicitly approves the
// cost-protected Google integration in the next phase.
export async function searchGooglePlaces() {
  throw new Error('Live Google Places search is disabled during the offline fixture phase.');
}

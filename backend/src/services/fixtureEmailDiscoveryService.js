// Local-only email-discovery outcomes. These stand in for public website checks
// while WEBSITE_EMAIL_DISCOVERY_ENABLED remains false.
const fixtureEmails = new Map([
  ['fixture-auto-001', { email: 'service@martys-auto.example', sourceUrl: 'https://martys-auto.example/contact' }],
  ['fixture-auto-003', { email: 'hello@riverbank-brake.example', sourceUrl: 'https://riverbank-brake.example/contact' }],
  ['fixture-auto-005', { email: 'service@delta-fleet.example', sourceUrl: 'https://delta-fleet.example/about' }],
  ['fixture-outreach-001', { email: 'hello@eastside-auto.example', sourceUrl: 'https://eastside-auto.example/contact' }],
  ['fixture-outreach-003', { email: 'team@modesto-motor.example', sourceUrl: 'https://modesto-motor.example/contact' }],
  ['fixture-outreach-006', { email: 'service@oakdale-tire.example', sourceUrl: 'https://oakdale-tire.example/about' }],
]);

export async function discoverFixturePublicEmail(lead) {
  if (!lead.website) return { status: 'no_website' };
  const result = fixtureEmails.get(lead.placeId);
  return result ? { status: 'found', ...result } : { status: 'not_found' };
}

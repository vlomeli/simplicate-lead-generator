// Offline development data. This service never makes a network request.
const fixturePlaces = [
  {
    id: 'fixture-auto-001',
    displayName: { text: 'Marty\'s Auto Repair, Inc.' },
    formattedAddress: '123 Main St, Modesto, CA',
    nationalPhoneNumber: '(209) 555-0123',
    websiteUri: 'https://martys-auto.example',
    rating: 3.8,
    userRatingCount: 47,
    primaryType: 'auto_repair',
  },
  {
    id: 'fixture-auto-002',
    displayName: { text: 'Central Valley Alignment' },
    formattedAddress: '42 Oak Avenue, Modesto, CA',
    primaryType: 'car_repair',
  },
  {
    id: 'fixture-auto-001',
    displayName: { text: 'Marty\'s Auto Repair, Inc.' },
    formattedAddress: '123 Main St, Modesto, CA',
    rating: 3.8,
    userRatingCount: 47,
    primaryType: 'auto_repair',
  },
  {
    id: 'fixture-auto-003',
    displayName: { text: 'Riverbank Brake & Tire' },
    formattedAddress: '801 Patterson Road, Modesto, CA',
    nationalPhoneNumber: '(209) 555-0148',
    websiteUri: 'https://riverbank-brake.example',
    rating: 4.4,
    userRatingCount: 86,
    primaryType: 'auto_repair',
  },
  {
    id: 'fixture-auto-004',
    displayName: { text: 'Northside Smog & Service' },
    formattedAddress: '19 Coffee Road, Modesto, CA',
    websiteUri: 'https://northside-smog.example',
    rating: 4.1,
    userRatingCount: 31,
    primaryType: 'car_repair',
  },
  {
    id: 'fixture-auto-005',
    displayName: { text: 'Delta Fleet Maintenance' },
    formattedAddress: '275 Industrial Way, Modesto, CA',
    nationalPhoneNumber: '(209) 555-0176',
    websiteUri: 'https://delta-fleet.example',
    rating: 4.7,
    userRatingCount: 119,
    primaryType: 'auto_repair',
  },
];

export async function searchFixturePlaces({ maxResults }) {
  return fixturePlaces.slice(0, maxResults);
}

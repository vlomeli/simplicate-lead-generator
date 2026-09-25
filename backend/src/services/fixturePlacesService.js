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
];

export async function searchFixturePlaces({ maxResults }) {
  return fixturePlaces.slice(0, maxResults);
}

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
  {
    id: 'fixture-outreach-001', displayName: { text: 'Eastside Auto Care' },
    formattedAddress: '1100 Scenic Drive, Modesto, CA', websiteUri: 'https://eastside-auto.example',
    rating: 4.5, userRatingCount: 64, primaryType: 'auto_repair',
  },
  {
    id: 'fixture-outreach-002', displayName: { text: 'Ceres Transmission Center' },
    formattedAddress: '2100 Hatch Road, Ceres, CA', nationalPhoneNumber: '(209) 555-0181',
    websiteUri: 'https://ceres-transmission.example', rating: 4.2, userRatingCount: 52, primaryType: 'car_repair',
  },
  {
    id: 'fixture-outreach-003', displayName: { text: 'Modesto Motor Works' },
    formattedAddress: '333 McHenry Avenue, Modesto, CA', websiteUri: 'https://modesto-motor.example',
    rating: 4.6, userRatingCount: 97, primaryType: 'auto_repair',
  },
  {
    id: 'fixture-outreach-004', displayName: { text: 'Turlock Roadside Service' },
    formattedAddress: '905 Lander Avenue, Turlock, CA', nationalPhoneNumber: '(209) 555-0199',
    rating: 4.0, userRatingCount: 28, primaryType: 'car_repair',
  },
  {
    id: 'fixture-outreach-005', displayName: { text: 'Valley Diagnostic Garage' },
    formattedAddress: '77 Dale Road, Modesto, CA', websiteUri: 'https://valley-diagnostic.example',
    rating: 4.3, userRatingCount: 41, primaryType: 'auto_repair',
  },
  {
    id: 'fixture-outreach-006', displayName: { text: 'Oakdale Tire & Service' },
    formattedAddress: '140 West F Street, Oakdale, CA', nationalPhoneNumber: '(209) 555-0167',
    websiteUri: 'https://oakdale-tire.example', rating: 4.7, userRatingCount: 103, primaryType: 'car_repair',
  },
];

export async function searchFixturePlaces({ maxResults }) {
  return fixturePlaces.slice(0, maxResults);
}

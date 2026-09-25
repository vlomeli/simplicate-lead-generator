/**
 * Application lead contract (provider-independent):
 * - placeId and name are required strings.
 * - address, phone, website, rating, reviewCount, category, and recipientEmail
 *   may be null when the provider does not supply them.
 * - emailStatus always begins as "not_sent".
 *
 * The input shape below matches Google Places API (New) Text Search responses.
 * Keeping this conversion here means the rest of the application never relies
 * on provider-specific property names.
 */
export function normalizeLead(place) {
  const placeId = place?.id ?? place?.place_id;
  const name = place?.displayName?.text ?? place?.name;

  if (typeof placeId !== 'string' || placeId.trim() === '') {
    throw new Error('A provider result is missing its place ID.');
  }

  if (typeof name !== 'string' || name.trim() === '') {
    throw new Error(`Provider result ${placeId} is missing its business name.`);
  }

  return {
    placeId,
    name,
    address: optionalString(place.formattedAddress ?? place.address),
    phone: optionalString(place.nationalPhoneNumber ?? place.phone),
    website: optionalString(place.websiteUri ?? place.website),
    rating: optionalNumber(place.rating),
    reviewCount: optionalInteger(place.userRatingCount ?? place.reviewCount),
    category: optionalString(place.primaryType ?? place.category),
    recipientEmail: optionalString(place.recipientEmail),
    emailStatus: 'not_sent',
  };
}

function optionalString(value) {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function optionalNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function optionalInteger(value) {
  return Number.isInteger(value) ? value : null;
}

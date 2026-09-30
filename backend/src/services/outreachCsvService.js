const outreachColumns = ['email', 'name', 'address', 'phone', 'website', 'rating', 'reviews', 'category', 'place_id', 'email_source_url'];
const fullColumns = [...outreachColumns, 'email_status'];

export function createOutreachCsv(results) {
  const readyResults = results.filter(result => result.email_status === 'found' && result.recipient_email);
  return createCsv(outreachColumns, readyResults.map(result => [
    result.recipient_email, result.business_name, result.address, result.phone, result.website,
    result.rating, result.review_count, result.category, result.place_id, result.email_source_url,
  ]));
}

export function createFullResultsCsv(results) {
  return createCsv(fullColumns, results.map(result => [
    result.recipient_email, result.business_name, result.address, result.phone, result.website,
    result.rating, result.review_count, result.category, result.place_id, result.email_source_url,
    result.email_status,
  ]));
}

function createCsv(headers, rows) {
  return [headers, ...rows].map(row => row.map(escapeCsvValue).join(',')).join('\n') + '\n';
}

function escapeCsvValue(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

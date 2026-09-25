import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const csvColumns = [
  'place_id', 'business_name', 'address', 'phone', 'website', 'rating',
  'review_count', 'category', 'recipient', 'email_status',
];
const defaultExportDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)), '../../data/exports',
);

// Generated CSV files are intentionally ignored by Git.
export async function exportLeadsToCsv(leads, { exportDirectory = defaultExportDirectory } = {}) {
  await mkdir(exportDirectory, { recursive: true });

  const filename = `leads-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
  const filePath = path.join(exportDirectory, filename);
  const rows = leads.map(leadToCsvRow);
  const csv = [csvColumns, ...rows].map(row => row.map(escapeCsvValue).join(',')).join('\n') + '\n';

  await writeFile(filePath, csv, 'utf8');

  return { filename, filePath, leadCount: leads.length };
}

function leadToCsvRow(lead) {
  return [
    lead.placeId, lead.name, lead.address, lead.phone, lead.website, lead.rating,
    lead.reviewCount, lead.category, lead.recipientEmail, lead.emailStatus,
  ];
}

function escapeCsvValue(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

import { diagnosePublicWebsite } from '../services/websiteEmailDiscoveryService.js';

const website = process.argv[2];

if (!website) {
  console.error('Usage: npm run diagnose:website -- <website-url>');
  process.exitCode = 1;
} else {
  const result = await diagnosePublicWebsite(website);
  console.log(JSON.stringify(result, null, 2));
}

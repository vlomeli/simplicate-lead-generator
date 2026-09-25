# Sprint One — Private Lead Discovery and Review Workflow

## Current checkpoint — do not enable Google yet

The offline backend workflow is complete. It is deliberately fixture-only and
does not contact Google. The next work is Supabase-backed authentication,
persistence, and the server-side usage guardrails. Live Places access remains
out of bounds until the owner explicitly approves it after those guardrails are
verified.

## Outcome

Create a private website where an authorized user can find a small batch of
business leads, review them, and download a CSV. The first sprint stops before
automated outreach: email messages are reviewed and sent manually through a
Google Sheets mail merge.

## Scope

### 1. Private access

- The site requires sign-in with email and password.
- The user can request a password-reset email.
- Only approved users can view, search, or export leads.

### 2. Lead discovery

- The user enters a business category, location, and maximum result count
  (initially up to 50).
- The server queries the Google Places API and displays the results.
- Each result includes:
  - `placeId`
  - `business_name`
  - `address`
  - `phone`
  - `website`
  - `rating`
  - `review_count`
  - `category`
  - `recipient` (a publicly listed business email, when available)
- `placeId` is stored permanently so a business is not collected twice.
- The user can download newly found leads as a CSV.

## Important Google Places constraints

- Google Places does **not** provide business email addresses. It can provide
  the business website, where a clearly published business contact address may
  be found. If no appropriate public email is available, leave `recipient`
  blank.
- Google allows `placeId` values to be stored, but Places data has storage and
  attribution restrictions. Keep the integration small, display attribution as
  required, and do not treat Google Places as a permanent bulk-export data
  source.
- A Google Cloud billing account is required for Places API access. The service
  has monthly free usage caps, so initial tests should be configured with
  budget alerts and request limits.

## Free-usage protection

Google Places charges by API request, not by tokens or by the number of
businesses returned. One Text Search request can normally return up to 50
businesses. Therefore, searching for 50 businesses per day is approximately 30
requests and 1,500 businesses over a 30-day month, before pagination or other
calls are considered.

The planned search includes phone, website, rating, and review count. These
fields currently trigger Google's Places API Text Search Enterprise SKU, which
has a free usage cap of 1,000 requests per month. Google pricing can change;
confirm the cap in the Google Cloud project before launch.

The private site must protect this allowance:

- Set a configurable monthly safety limit of 900 requests by default, preserving
  a 100-request buffer below the current published free cap.
- Store each successful request in a monthly usage record. Reserve the request
  atomically before calling Google so concurrent searches cannot overspend.
- Show the signed-in user the monthly safety limit, requests used, requests
  remaining, and the next reset date.
- Block the search before the safety limit is exceeded. The interface must say
  that lead searches are paused until the monthly reset or the project owner
  intentionally upgrades the available allowance.
- Apply a modest per-user rate limit as additional protection against accidental
  double-clicks or abuse. Rate limiting alone is not enough; the monthly usage
  cap is the hard stop.
- Configure Google Cloud budget alerts at 50%, 80%, and 90%, lower the Google
  Places quota where available, and restrict the server-only API key to Places
  API and the production server. Alerts are warnings and do not themselves
  stop billing.

## CSV shape

```csv
place_id,business_name,address,phone,website,rating,review_count,category,recipient,email_status
ChIJexample,Acme Auto Repair,123 Main St Modesto CA,209-555-0123,https://acme.example,3.8,47,auto_repair,hello@acme.example,not_sent
```

`email_status` begins as `not_sent`. It becomes `sent` only after a message has
actually been sent. This makes the outreach list auditable and prevents repeat
messages.

## Email workflow (after the CSV is approved)

1. Download the reviewed CSV from the private site.
2. Import it into Google Sheets. Keep the headers as plain text.
3. Create a Gmail draft with merge placeholders matching the sheet headers.
4. Use a Google Apps Script mail merge to send one personal email per row.
5. The script writes an `Email Sent` timestamp or error back to the sheet and
   skips rows already marked sent.

Example Gmail draft:

```text
Subject: A quick idea for {{business_name}}

Hi {{business_name}} team,

I noticed your current Google rating is {{rating}}. We help local businesses
earn more genuine customer reviews and improve their online reputation.

Would you be open to a quick conversation?
```

The draft can also use `{{review_count}}`, `{{category}}`, or any other column
from the sheet. Use one recipient per email rather than BCCing a list.

## Why Google Apps Script

- It works with a normal Google account; paid Google Workspace mail merge is
  not required.
- It can read Google Sheets rows, replace placeholders in a Gmail draft, send
  HTML emails, and record a sent timestamp.
- It provides a practical free first iteration while keeping send decisions
  under human review.

Start with 10–20 reviewed messages per day. Send only to clearly published
business contact addresses, write truthful personalized messages, and include
an easy way to opt out. Gmail and Apps Script sending quotas apply.

## Out of scope for Sprint One

- Scheduled/cron lead searches
- Automated website email discovery at scale
- Automated sending from the website
- Reply handling, campaign analytics, or follow-up sequences

## References

- [Google Places API policies](https://developers.google.com/maps/documentation/places/web-service/policies)
- [Google Places pricing](https://developers.google.com/maps/billing-and-pricing/pricing)
- [Google's Apps Script mail-merge sample](https://developers.google.com/apps-script/samples/automations/mail-merge)
- [Gmail mail-merge limits](https://support.google.com/mail/answer/12921167)

# Simplicate Lead Generator

## Project summary

This project is a business lead-generation tool designed to help automate the process of finding potential business clients for a review-management service.

The goal is to reduce the manual work of researching businesses individually by using the Google Places API to discover relevant businesses, organize their information, and eventually use that data to create personalized outreach.

**Current focus:** Build the foundation by reliably discovering and exporting qualified business leads.

## Stage 1 — Google Places Lead Discovery

### Goal

Build a Node.js/Express API that searches the Google Places API using user-defined criteria and returns structured business data that can be used for lead generation.

### Requirements

The API should:

- Accept search criteria such as business type/category, location, and maximum number of results.
- Query the Google Places API.
- Normalize the API response into a consistent business object.
- Collect relevant fields:
  - `placeId`
  - `name`
  - `address`
  - `phone`
  - `website`
  - `rating`
  - `reviewCount`
  - `category`
- Use `placeId` to identify duplicate businesses.
- Maintain a temporary list of previously collected `placeId` values.
- Export newly discovered businesses to a CSV file.

### Example request

```http
POST /api/leads/search
Content-Type: application/json
```

```json
{
  "query": "auto repair",
  "location": "Modesto, CA",
  "maxResults": 20
}
```

### Expected flow

```text
Search criteria
      ↓
Google Places API
      ↓
Normalize results
      ↓
Check placeId
      ↓
Remove duplicates
      ↓
Export new leads → CSV
```

### Stage 1 success criteria

Given a search such as **Auto repair businesses in Modesto, CA**, the API should return and export a clean list of new businesses while ignoring businesses that have already been collected.

Nothing beyond lead discovery and CSV generation is part of Stage 1.

## Repository layout

```text
backend/
  src/
    config/       Environment configuration
    controllers/  Request and response handling
    routes/       API endpoint definitions
    services/     Google Places, deduplication, and CSV workflow
    utils/        Small reusable transformation helpers
  data/exports/   Generated CSV files (not committed)
```

## Getting started

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

In Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

The starter server runs on `http://localhost:5000`. Use `GET /api/health` to confirm it is running. The lead-search route is scaffolded at `POST /api/leads/search`; its Google Places and CSV implementation is the next Stage 1 task.

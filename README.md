Project Summary

This project is a business lead-generation tool designed to help automate the process of finding potential business clients for a review-management service.

The goal is to reduce the manual work of researching businesses individually by using the Google Places API to discover relevant businesses, organize their information, and eventually use that data to create personalized outreach.

Current focus: Build the foundation by reliably discovering and exporting qualified business leads.

===

Stage 1 — Google Places Lead Discovery
Goal

Build a Node.js/Express API that searches the Google Places API using user-defined criteria and returns structured business data that can be used for lead generation.

Requirements
Accept search criteria such as:
Business type/category
Location
Maximum number of results
Query the Google Places API.
Normalize the API response into a consistent business object.
Collect relevant fields such as:
placeId
name
address
phone
website
rating
reviewCount
category
Use placeId to identify duplicate businesses.
Maintain a temporary list of previously collected placeId values.
Export newly discovered businesses to a CSV file.
Example Request
POST /api/leads/search
{
  "query": "auto repair",
  "location": "Modesto, CA",
  "maxResults": 20
}
Expected Flow
Search Criteria
      ↓
Google Places API
      ↓
Normalize Results
      ↓
Check placeId
      ↓
Remove Duplicates
      ↓
Export New Leads → CSV
Stage 1 Success Criteria

Given a search such as:

Auto repair businesses in Modesto, CA

the API should return and export a clean list of new businesses, while ignoring businesses that have already been collected.

Nothing beyond lead discovery and CSV generation is part of Stage 1.
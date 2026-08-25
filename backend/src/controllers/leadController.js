// Controllers translate HTTP requests into calls to the application services.
// Validation and the real search workflow will be added when Stage 1 is built.
export function searchLeads(_request, response) {
  response.status(501).json({
    error: 'Lead search has not been implemented yet.',
    nextStep: 'Connect the Google Places service, normalize results, deduplicate them, and export new leads to CSV.',
  });
}

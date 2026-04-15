// ── Google Maps constants ──────────────────────────────────────────────────────

export const GOOGLE_MAPS_COLOR = '#10B981';

interface GoogleMapsDefaults {
  minRating: number;
  minReviews: number;
  maxResults: number;
}

export const GOOGLE_MAPS_DEFAULTS: GoogleMapsDefaults = {
  minRating:  3.5,
  minReviews: 10,
  maxResults: 50,
};

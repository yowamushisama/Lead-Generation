export const GENERIC_TITLES = /^(home|index|welcome|untitled)$/i;
export const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;

// Industries where booking widgets, 24/7 framing, and maintenance plans are
// genuinely expected. Used to gate the service-industry-only sub-factors so
// we don't penalize a SaaS company for "missing" a booking widget.
export const SERVICE_INDUSTRY_KEYWORDS = [
  'hvac',
  'heating',
  'cooling',
  'plumbing',
  'plumber',
  'electrician',
  'electrical',
  'roofing',
  'roofer',
  'pest control',
  'cleaning',
  'landscaping',
  'lawn care',
  'dental',
  'dentist',
  'medical',
  'salon',
  'spa',
  'auto repair',
  'mechanic',
  'locksmith',
  'garage door',
  'appliance repair',
  'home services',
  'contractor',
  'restoration',
  'water damage',
];

export const TWENTY_FOUR_SEVEN_INDUSTRY_KEYWORDS = [
  'hvac',
  'plumbing',
  'plumber',
  'electrician',
  'electrical',
  'locksmith',
  'pest control',
  'roofing',
  'garage door',
  'water damage',
  'restoration',
];

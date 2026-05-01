export const CTA_PATTERN = /\b(book|call|quote|contact|schedule|get\s+started|free\s+estimate|request|appointment)\b/i;

export const TECH_FINGERPRINTS: Array<[RegExp, string]> = [
  [/wp-content|wp-includes/i, 'WordPress'],
  [/Shopify\.theme|cdn\.shopify/i, 'Shopify'],
  [/<meta[^>]+generator[^>]+Wix/i, 'Wix'],
  [/squarespace\.com|static\.squarespace/i, 'Squarespace'],
  [/weebly\.com/i, 'Weebly'],
  [/_next\/static|__NEXT_DATA__/i, 'Next.js'],
  [/nuxt|__nuxt/i, 'Nuxt'],
  [/ng-version|angular/i, 'Angular'],
  [/react\.development|react-dom/i, 'React'],
  [/joomla/i, 'Joomla'],
  [/drupal/i, 'Drupal'],
  [/cargo\.site/i, 'Cargo'],
  [/godaddy\.com/i, 'GoDaddy Website Builder'],
];

export const FETCH_TIMEOUT_MS = 5000;

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

// ── Deep-signal vendor fingerprints ──────────────────────────────────────────
// These are pure regex matches against the raw HTML we already fetch. Vendors
// that inject their widgets via runtime JS (no <script src>) won't be caught;
// ~85% recall is the accepted trade-off vs. running Playwright per lead.

export const CHATBOT_VENDORS: Array<[RegExp, string]> = [
  [/widget\.intercom\.io|intercomcdn\.com/i, 'intercom'],
  [/js\.driftt\.com|drift\.com\/embed/i, 'drift'],
  [/js\.hs-scripts\.com|js\.hs-banner\.com|hubspot\.com\/.*messages/i, 'hubspot'],
  [/embed\.tawk\.to|tawk\.to\/chat/i, 'tawk'],
  [/client\.crisp\.chat|crisp\.chat\/load/i, 'crisp'],
  [/code\.tidio\.co|tidio\.co\/widget/i, 'tidio'],
  [/static\.zdassets\.com|zopim\.com/i, 'zendesk'],
  [/manychat\.com\/fb|cdn\.manychat/i, 'manychat'],
  [/chatbase\.co\/embed/i, 'chatbase'],
  [/livechatinc\.com|livechat\.com\/embed/i, 'livechat'],
  [/voiceflow\.com\/widget/i, 'voiceflow'],
  [/botpress\.cloud/i, 'botpress'],
];

export const BOOKING_VENDORS: Array<[RegExp, string]> = [
  [/assets\.calendly\.com|calendly\.com\/embed/i, 'calendly'],
  [/acuityscheduling\.com\/(schedule|js)/i, 'acuity'],
  [/servicetitan\.com\/(online-booking|scheduler)/i, 'servicetitan'],
  [/housecallpro\.com\/(embed|book)/i, 'housecallpro'],
  [/getjobber\.com\/embed/i, 'jobber'],
  [/bookingkoala\.com/i, 'bookingkoala'],
  [/setmore\.com\/widget/i, 'setmore'],
  [/squareup\.com\/appointments/i, 'square-appointments'],
  [/booksy\.com\/widget/i, 'booksy'],
  [/cal\.com\/embed/i, 'cal.com'],
];

export const CRM_VENDORS: Array<[RegExp, string]> = [
  [/servicetitan\.com/i, 'ServiceTitan'],
  [/js\.hsforms\.net|forms\.hsforms\.com/i, 'HubSpot'],
  [/housecallpro\.com/i, 'HousecallPro'],
  [/getjobber\.com/i, 'Jobber'],
  [/salesforce\.com\/embed/i, 'Salesforce'],
  [/zoho\.com\/(crm|forms)/i, 'Zoho'],
  [/pipedrive\.com\/embed/i, 'Pipedrive'],
];

export const ANALYTICS_VENDORS: Array<[RegExp, string]> = [
  [/googletagmanager\.com|www\.google-analytics\.com|gtag\(/i, 'GA4'],
  [/connect\.facebook\.net|fbq\(/i, 'Meta Pixel'],
  [/static\.hotjar\.com|hotjar\.com\/c/i, 'Hotjar'],
  [/clarity\.ms/i, 'MS Clarity'],
  [/cdn\.mxpnl\.com|mixpanel/i, 'Mixpanel'],
  [/cdn\.segment\.com/i, 'Segment'],
];

export const EMAIL_MARKETING_VENDORS: Array<[RegExp, string]> = [
  [/cdn\.mailchimp\.com|chimpstatic\.com/i, 'Mailchimp'],
  [/static\.klaviyo\.com|klaviyo\.com\/onsite/i, 'Klaviyo'],
  [/js\.hsforms\.net/i, 'HubSpot'],
  [/list-manage\.com/i, 'Mailchimp'],
  [/activehosted\.com|activecampaign/i, 'ActiveCampaign'],
  [/sendinblue\.com|brevo\.com/i, 'Brevo'],
];

// Calculator/estimate detection — looks for buttons, form actions, or page slugs
export const CALCULATOR_PATTERN =
  /\b(instant\s+(quote|estimate)|price\s+(calculator|estimator)|get\s+a\s+free\s+estimate|estimate\s+calculator|cost\s+calculator|quote\s+tool)\b/i;

// Live-chat (human, not bot) — mostly Olark / Front / generic "chat with us" badges
export const LIVE_CHAT_PATTERN =
  /\b(chat\s+with\s+(us|an?\s+agent)|live\s+chat|chat\s+now|talk\s+to\s+a\s+representative)\b/i;

// Emergency positioning detection
export const EMERGENCY_PATTERN = /\b(24\/7|emergency\s+(service|repair|hvac|plumbing)|24\s+hour\s+emergency)\b/i;

// Sticky header / floating CTA / phone link
export const STICKY_HEADER_PATTERN = /position\s*:\s*(sticky|fixed)[^;]*top\s*:\s*0|class=["'][^"']*(sticky|fixed-top)[^"']*["']/i;
export const FLOATING_CTA_PATTERN = /class=["'][^"']*(floating|sticky-cta|fab|fixed-cta|chat-bubble)[^"']*["']/i;

// Schema.org JSON-LD
export const JSON_LD_BLOCK_PATTERN = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

// Content depth
export const TEAM_PAGE_PATTERN = /\b(our\s+team|meet\s+the\s+team|about\s+us|our\s+technicians|staff)\b|\/(team|about-us|our-team|technicians)\b/i;
export const BLOG_PATTERN = /\/blog\b|<a[^>]+href=["'][^"']*\/blog/i;
export const CASE_STUDIES_PATTERN = /\b(case\s+stud(y|ies)|success\s+stor(y|ies)|customer\s+stories)\b|\/(case-studies|success-stories)\b/i;
export const MAINTENANCE_PLAN_PATTERN =
  /\b(maintenance\s+(plan|agreement|membership)|service\s+(plan|club)|protection\s+plan|comfort\s+club|membership\s+program)\b/i;

// Locations listed
export const LOCATIONS_PATTERN = /\/(locations?|service-area|areas?-served|service-areas?)\b/gi;

// Industries that genuinely benefit from booking widgets / 24-7 emergency framing
export const SERVICE_INDUSTRIES = [
  'hvac',
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
];

export const TWENTY_FOUR_SEVEN_INDUSTRIES = [
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

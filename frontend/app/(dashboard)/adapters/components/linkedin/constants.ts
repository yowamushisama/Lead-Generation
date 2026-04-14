// ── LinkedIn-specific types ────────────────────────────────────────────────────

export type LinkedInTab      = 'search' | 'targeting' | 'session' | 'advanced';
export type SearchMode       = 'posts_by_keyword' | 'my_connections' | 'company_followers' | 'job_posters';
export type SeniorityLevel   = 'c_suite' | 'vp' | 'director' | 'manager' | 'ic';
export type ConnectionDegree = '1st' | '2nd' | '3rd';
export type CompanySize      = '1-10' | '11-50' | '51-200' | '201-1000' | '1000+';

// ── LinkedIn constants ─────────────────────────────────────────────────────────

export const LI_COLOR = '#4A9EF5';

export const LI_TABS: { id: LinkedInTab; label: string }[] = [
  { id: 'search',    label: 'Search Config' },
  { id: 'targeting', label: 'Targeting' },
  { id: 'session',   label: 'Session & Proxy' },
  { id: 'advanced',  label: 'Advanced' },
];

export const SEARCH_MODES: { id: SearchMode; label: string }[] = [
  { id: 'posts_by_keyword',  label: 'Posts by Keyword' },
  { id: 'my_connections',    label: 'My Connections' },
  { id: 'company_followers', label: 'Company Followers' },
  { id: 'job_posters',       label: 'Job Posters' },
];

export const SENIORITY_LEVELS: { id: SeniorityLevel; label: string }[] = [
  { id: 'c_suite',  label: 'C-Suite' },
  { id: 'vp',       label: 'VP' },
  { id: 'director', label: 'Director' },
  { id: 'manager',  label: 'Manager' },
  { id: 'ic',       label: 'Individual Contributor' },
];

export const COMPANY_SIZES: CompanySize[]       = ['1-10', '11-50', '51-200', '201-1000', '1000+'];
export const CONNECTION_DEGREES: ConnectionDegree[] = ['1st', '2nd', '3rd'];

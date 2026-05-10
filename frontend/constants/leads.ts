import type { LeadStatus, LeadTier, LeadSource } from '@/models';

export const ALL_STATUSES: LeadStatus[] = [
  'NEW', 'ENRICHED', 'SCORED', 'PERSONALIZED', 'MESSAGE_DRAFTED',
  'MESSAGE_APPROVED', 'OUTREACH_SENT', 'REPLIED', 'MEETING_BOOKED',
  'CONVERTED', 'DISQUALIFIED', 'OPT_OUT',
];

export const TIER_OPTIONS: { value: LeadTier | 'all'; label: string }[] = [
  { value: 'all', label: 'All Tiers' },
  { value: 'HOT',  label: 'HOT' },
  { value: 'WARM', label: 'WARM' },
  { value: 'COLD', label: 'COLD' },
];

export const KANBAN_COLUMNS: { id: LeadStatus; label: string }[] = [
  { id: 'NEW', label: 'New' },
  { id: 'ENRICHED', label: 'Enriched' },
  { id: 'SCORED', label: 'Scored' },
  { id: 'OUTREACH_SENT', label: 'Messaged' },
  { id: 'REPLIED', label: 'Replied' },
  { id: 'MEETING_BOOKED', label: 'Meeting' },
  { id: 'CONVERTED', label: 'Converted' },
];

export const TIER_COLORS: Record<string, string> = {
  HOT: 'bg-gold/10 text-gold',
  WARM: 'bg-tangerine/10 text-tangerine',
  COLD: 'bg-aqua/10 text-aqua',
};

export const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW:              'New',
  ENRICHED:         'Enriched',
  SCORED:           'Scored',
  PERSONALIZED:     'Personalized',
  MESSAGE_DRAFTED:  'Drafted',
  MESSAGE_APPROVED: 'Approved',
  OUTREACH_SENT:    'Sent',
  REPLIED:          'Replied',
  MEETING_BOOKED:   'Meeting',
  CONVERTED:        'Converted',
  DISQUALIFIED:     'Disqualified',
  OPT_OUT:          'Opted Out',
};

export const SOURCE_OPTIONS: { value: LeadSource; label: string }[] = [
  { value: 'linkedin',    label: 'LinkedIn' },
  { value: 'google_maps', label: 'Maps' },
  { value: 'csv_import',  label: 'CSV' },
  { value: 'webhook',     label: 'Webhook' },
  { value: 'reddit',      label: 'Reddit' },
  { value: 'manual',      label: 'Manual' },
  { value: 'api',         label: 'API' },
];

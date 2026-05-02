import type { LeadStatus, LeadTier } from '@/models';

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

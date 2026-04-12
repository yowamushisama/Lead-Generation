import type { LeadStatus } from '@/models';

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

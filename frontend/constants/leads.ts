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
  HOT: 'bg-red-100 text-red-700',
  WARM: 'bg-amber-100 text-amber-700',
  COLD: 'bg-blue-100 text-blue-700',
};

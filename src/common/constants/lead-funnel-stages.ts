import { LeadStatus } from '../enums/lead-status.enum';

export const LEAD_FUNNEL_STAGES = [
  LeadStatus.NEW,
  LeadStatus.ENRICHED,
  LeadStatus.SCORED,
  LeadStatus.PERSONALIZED,
  LeadStatus.MESSAGE_DRAFTED,
  LeadStatus.MESSAGE_APPROVED,
  LeadStatus.OUTREACH_SENT,
  LeadStatus.REPLIED,
  LeadStatus.MEETING_BOOKED,
  LeadStatus.CONVERTED,
] as const;

import { Link2, MapPin, FileSpreadsheet, Webhook, UserPlus } from 'lucide-react';
import type { CampaignObjective, OutreachTone, ApprovalMode, CampaignStatus } from '@/models';

// ── Lead source options ───────────────────────────────────────────────────────

export const CAMPAIGN_LEAD_SOURCES = [
  { id: 'linkedin',    label: 'LinkedIn',    Icon: Link2 },
  { id: 'google_maps', label: 'Google Maps', Icon: MapPin },
  { id: 'csv_import',  label: 'CSV Import',  Icon: FileSpreadsheet },
  { id: 'webhook',     label: 'Webhook',     Icon: Webhook },
  { id: 'manual',      label: 'Manual',      Icon: UserPlus },
] as const;

// ── Outreach channel options ──────────────────────────────────────────────────

export const CAMPAIGN_OUTREACH_CHANNELS = [
  { id: 'email',       label: 'Email' },
  { id: 'linkedin_dm', label: 'LinkedIn DM' },
] as const;

// ── Campaign objective options ────────────────────────────────────────────────

export const CAMPAIGN_OBJECTIVES: { id: CampaignObjective; label: string }[] = [
  { id: 'replies',       label: 'Replies' },
  { id: 'calls_booked',  label: 'Calls Booked' },
  { id: 'demo_requests', label: 'Demo Requests' },
  { id: 'meetings',      label: 'Meetings' },
];

export const OBJECTIVE_LABELS: Record<CampaignObjective, string> = {
  replies:       'Replies',
  calls_booked:  'Calls',
  demo_requests: 'Demos',
  meetings:      'Meetings',
};

// ── Outreach tone options ─────────────────────────────────────────────────────

export const CAMPAIGN_TONES: { id: OutreachTone; label: string }[] = [
  { id: 'professional',  label: 'Professional' },
  { id: 'casual',        label: 'Casual' },
  { id: 'direct',        label: 'Direct' },
  { id: 'consultative',  label: 'Consultative' },
];

// ── Approval mode options ─────────────────────────────────────────────────────

export const CAMPAIGN_APPROVAL_MODES: { id: ApprovalMode; label: string; desc: string }[] = [
  { id: 'manual',    label: 'Manual',    desc: 'Every message requires your approval' },
  { id: 'semi_auto', label: 'Semi-auto', desc: 'Auto-approve WARM leads, review HOT' },
  { id: 'auto',      label: 'Auto',      desc: 'All approved messages send immediately' },
];

// ── Status filter tabs ────────────────────────────────────────────────────────

export const CAMPAIGN_STATUS_TABS: { label: string; value: string | undefined }[] = [
  { label: 'All',      value: undefined },
  { label: 'Active',   value: 'ACTIVE' },
  { label: 'Paused',   value: 'PAUSED' },
  { label: 'Draft',    value: 'DRAFT' },
  { label: 'Archived', value: 'ARCHIVED' },
];

// ── Status visual config ──────────────────────────────────────────────────────

export const CAMPAIGN_STATUS_CONFIG: Record<CampaignStatus, { bg: string; text: string; dot: string }> = {
  ACTIVE:   { bg: 'bg-jade/10',  text: 'text-jade',  dot: 'bg-jade animate-pulse-dot' },
  PAUSED:   { bg: 'bg-gold/10',  text: 'text-gold',  dot: 'bg-gold' },
  DRAFT:    { bg: 'bg-mist/10',  text: 'text-mist',  dot: 'bg-mist' },
  ARCHIVED: { bg: 'bg-dusk/10',  text: 'text-dusk',  dot: 'bg-dusk' },
};

// ── Pipeline / chart stage config ─────────────────────────────────────────────

export const LEAD_PIPELINE_STAGES = [
  'NEW', 'ENRICHED', 'SCORED', 'PERSONALIZED',
  'MESSAGE_DRAFTED', 'OUTREACH_SENT', 'REPLIED', 'CONVERTED',
] as const;

export const MESSAGE_DELIVERY_STAGES = [
  'PENDING_APPROVAL', 'APPROVED', 'SENT', 'DELIVERED', 'OPENED', 'REPLIED',
] as const;

export const PIPELINE_STAGE_COLORS: Record<string, string> = {
  NEW:              '#6ba3be',
  ENRICHED:         '#7ab3cf',
  SCORED:           '#8dc0d8',
  PERSONALIZED:     '#a0cddf',
  MESSAGE_DRAFTED:  '#b3d9e6',
  OUTREACH_SENT:    '#7ec8a4',
  REPLIED:          '#5ab88a',
  CONVERTED:        '#3aa870',
};

export const MESSAGE_STAGE_COLORS: Record<string, string> = {
  PENDING_APPROVAL: '#8b8fa8',
  APPROVED:         '#a0a8c0',
  SENT:             '#7ab3cf',
  DELIVERED:        '#8dc0d8',
  OPENED:           '#7ec8a4',
  REPLIED:          '#3aa870',
};

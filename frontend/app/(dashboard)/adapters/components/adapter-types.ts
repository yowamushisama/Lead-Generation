import type { ComponentType } from 'react';
import { FileSpreadsheet, Link2, Map, Webhook } from 'lucide-react';

// ── Shared types ───────────────────────────────────────────────────────────────

export type AdapterId = 'csv' | 'linkedin' | 'google_maps' | 'webhook';
export type AdapterStatus = 'active' | 'inactive' | 'running' | 'error';
export type TagAccent = 'aqua' | 'jade' | 'orchid' | 'crimson';

export interface AdapterMeta {
  id: AdapterId;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
  leadsIngested: number;
  lastRun?: string;
  status: AdapterStatus;
  errorRate: number;
}

// ── Adapter registry ───────────────────────────────────────────────────────────

export const ADAPTERS: AdapterMeta[] = [
  {
    id: 'csv',
    label: 'CSV Import',
    description: 'Import leads from CSV or Excel files. Auto-detects name, email, company, role, industry, and location columns with flexible mapping.',
    icon: FileSpreadsheet,
    color: '#7C3AED',
    leadsIngested: 2109,
    lastRun: new Date(Date.now() - 86_400_000).toISOString(),
    status: 'inactive',
    errorRate: 0,
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    description: 'Scrapes LinkedIn posts by keyword using Playwright stealth automation. Extracts buyer intent signals from content and profiles.',
    icon: Link2,
    color: '#4A9EF5',
    leadsIngested: 847,
    lastRun: new Date(Date.now() - 3_600_000).toISOString(),
    status: 'active',
    errorRate: 2.4,
  },
  {
    id: 'google_maps',
    label: 'Google Maps',
    description: 'Discovers local businesses via Google Places API. Returns business name, rating, review count, and contact info.',
    icon: Map,
    color: '#10B981',
    leadsIngested: 1243,
    lastRun: new Date(Date.now() - 7_200_000).toISOString(),
    status: 'active',
    errorRate: 0.8,
  },
  {
    id: 'webhook',
    label: 'Webhook',
    description: 'Receive leads via HTTP POST from any external tool. HMAC signature verification ensures request authenticity.',
    icon: Webhook,
    color: '#F59E0B',
    leadsIngested: 322,
    lastRun: new Date(Date.now() - 1_800_000).toISOString(),
    status: 'active',
    errorRate: 0.5,
  },
];

// ── Status display map ─────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<AdapterStatus, { label: string; dot: string; text: string }> = {
  active:   { label: 'Active',   dot: 'dot-live',    text: 'text-jade' },
  inactive: { label: 'Inactive', dot: 'dot-idle',    text: 'text-dusk' },
  running:  { label: 'Running',  dot: 'dot-warning', text: 'text-gold' },
  error:    { label: 'Error',    dot: 'dot-error',   text: 'text-crimson' },
};

// ── Tag accent class map ───────────────────────────────────────────────────────

export const TAG_ACCENT_CLASSES: Record<TagAccent, string> = {
  aqua:    'bg-aqua/10 text-aqua',
  jade:    'bg-jade/10 text-jade',
  orchid:  'bg-orchid/10 text-orchid',
  crimson: 'bg-crimson/10 text-crimson',
};

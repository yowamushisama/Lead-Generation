import type { ScoringFactor, ScoringSignal } from '@/models';

export type GapCategory = 'seo' | 'ux' | 'tech' | 'reviews' | 'positioning';

export interface ParsedGap {
  label: string;
  weight: number;
  category: GapCategory;
}

export const INTENT_TYPE_LABELS: Record<string, string> = {
  incoming:     'Incoming buyer signal',
  exploratory:  'Exploring solutions',
  comparison:   'Comparing vendors',
  ready_to_buy: 'Ready to purchase',
  purchase:     'Ready to purchase',
  evaluation:   'Evaluating options',
  awareness:    'Building awareness',
  consideration:'In consideration',
};

export const INTENT_URGENCY_LABELS: Record<string, string> = {
  high:      'High urgency',
  medium:    'Medium urgency',
  low:       'Low urgency',
  immediate: 'Immediate (within days)',
  incoming:  'Incoming (active signal)',
};

export const CATEGORY_CONFIG: Record<GapCategory, { label: string; textCls: string; borderCls: string; bgCls: string }> = {
  seo:         { label: 'SEO',             textCls: 'text-aqua',      borderCls: 'border-aqua/20',      bgCls: 'bg-aqua/5' },
  ux:          { label: 'UX & Conversion', textCls: 'text-orchid',    borderCls: 'border-orchid/20',    bgCls: 'bg-orchid/5' },
  tech:        { label: 'Tech Stack',      textCls: 'text-gold',      borderCls: 'border-gold/20',      bgCls: 'bg-gold/5' },
  reviews:     { label: 'Reviews',         textCls: 'text-tangerine', borderCls: 'border-tangerine/20', bgCls: 'bg-tangerine/5' },
  positioning: { label: 'Positioning',     textCls: 'text-jade',      borderCls: 'border-jade/20',      bgCls: 'bg-jade/5' },
};

export const CATEGORY_ORDER: GapCategory[] = ['seo', 'ux', 'tech', 'reviews', 'positioning'];

export const NAV_SECTIONS = [
  { id: 'contact',  label: 'Contact' },
  { id: 'gaps',     label: 'Digital Gaps' },
  { id: 'score',    label: 'Scoring' },
  { id: 'intent',   label: 'Intent' },
  { id: 'audit',    label: 'Audit' },
  { id: 'reviews',  label: 'Reviews' },
  { id: 'messages', label: 'Outreach' },
];

const SENTINEL_VALUES = new Set(['coming', 'pending', 'unknown', 'n/a', 'none', 'null', '']);

export function prettyIntent(value: string | null | undefined, map: Record<string, string>): string | null {
  if (!value) return null;
  const key = value.toLowerCase().trim();
  if (SENTINEL_VALUES.has(key)) return null;
  return map[key] ?? value.replace(/_/g, ' ');
}

export function categorizeGap(label: string): GapCategory {
  const l = label.toLowerCase();
  if (l.includes('review') || l.includes('rating')) return 'reviews';
  if (l.includes('emergency') || l.includes('24-7') || l.includes('positioning')) return 'positioning';
  if (l.includes('chatbot') || l.includes('booking') || l.includes('estimate') || l.includes('calculator') || l.includes('live chat') || l.includes('maintenance') || l.includes('membership')) return 'ux';
  if (l.includes('title') || l.includes('meta') || l.includes('cta')) return 'seo';
  return 'tech';
}

export function parseGaps(factor: ScoringFactor | undefined): ParsedGap[] {
  if (!factor) return [];

  if (factor.signals && factor.signals.length > 0) {
    return factor.signals.map((s: ScoringSignal) => ({
      label: s.label,
      weight: s.weight,
      category: (s.category as GapCategory) ?? categorizeGap(s.label),
    }));
  }

  const reasoning = factor.reasoning ?? '';
  if (!reasoning || reasoning === 'No digital gaps detected') return [];
  const stripped = reasoning.replace(/^Digital opportunity signals:\s*/i, '');
  return stripped.split(/,\s*/).map((part) => {
    const m = part.match(/^(.+?)\s*\(\+(\d+)\)$/);
    if (!m) return null;
    return { label: m[1].trim(), weight: Number(m[2]), category: categorizeGap(m[1].trim()) };
  }).filter((g): g is ParsedGap => g !== null);
}

export function severityDotCls(w: number)   { return w >= 5 ? 'bg-crimson'  : w >= 3 ? 'bg-gold'  : 'bg-mist/50'; }
export function severityTextCls(w: number)  { return w >= 5 ? 'text-crimson': w >= 3 ? 'text-gold': 'text-mist'; }
export function severityBadgeCls(w: number) {
  return w >= 5
    ? 'bg-crimson/15 text-crimson ring-1 ring-crimson/40'
    : w >= 3
    ? 'bg-gold/15 text-gold ring-1 ring-gold/40'
    : 'bg-mist/10 text-mist ring-1 ring-ink/20';
}

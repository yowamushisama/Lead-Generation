import { cn } from '@/lib/utils';
import type { LeadStatus, LeadTier } from '@/models';

// ── Tier badge ──────────────────────────────────────────────────────────────

const TIER_STYLES: Record<LeadTier, string> = {
  HOT:  'bg-gold/10   text-gold   ring-gold/25   glow-gold',
  WARM: 'bg-tangerine/10 text-tangerine ring-tangerine/25',
  COLD: 'bg-aqua/10   text-aqua   ring-aqua/25',
};

export function TierBadge({ tier }: { tier: LeadTier }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-500 uppercase tracking-wider ring-1',
        TIER_STYLES[tier],
      )}
    >
      {tier === 'HOT' && <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse-dot" />}
      {tier}
    </span>
  );
}

// ── Status badge ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<LeadStatus, { bg: string; text: string; label: string }> = {
  NEW:              { bg: 'bg-mist/10',      text: 'text-mist',      label: 'New' },
  ENRICHED:         { bg: 'bg-aqua/10',      text: 'text-aqua',      label: 'Enriched' },
  SCORED:           { bg: 'bg-orchid/10',    text: 'text-orchid',    label: 'Scored' },
  PERSONALIZED:     { bg: 'bg-orchid/10',    text: 'text-orchid',    label: 'Personalized' },
  MESSAGE_DRAFTED:  { bg: 'bg-gold/10',      text: 'text-gold',      label: 'Drafted' },
  MESSAGE_APPROVED: { bg: 'bg-gold/15',      text: 'text-gold',      label: 'Approved' },
  OUTREACH_SENT:    { bg: 'bg-tangerine/10', text: 'text-tangerine', label: 'Sent' },
  REPLIED:          { bg: 'bg-jade/10',      text: 'text-jade',      label: 'Replied' },
  MEETING_BOOKED:   { bg: 'bg-jade/15',      text: 'text-jade',      label: 'Meeting' },
  CONVERTED:        { bg: 'bg-jade/20',      text: 'text-jade',      label: 'Converted' },
  DISQUALIFIED:     { bg: 'bg-dusk/20',      text: 'text-dusk',      label: 'Disqualified' },
  OPT_OUT:          { bg: 'bg-crimson/10',   text: 'text-crimson',   label: 'Opt-out' },
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  const s = STATUS_STYLES[status] ?? { bg: 'bg-mist/10', text: 'text-mist', label: status };
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 font-mono text-[10px] font-500', s.bg, s.text)}>
      {s.label}
    </span>
  );
}

// ── Source badge ────────────────────────────────────────────────────────────

const SOURCE_STYLES: Record<string, { icon: string; label: string; cls: string }> = {
  linkedin:    { icon: 'in', label: 'LinkedIn',   cls: 'bg-[#0A66C2]/15 text-[#4A9EF5]' },
  google_maps: { icon: 'G',  label: 'Maps',       cls: 'bg-jade/10 text-jade' },
  csv:         { icon: 'csv', label: 'CSV',        cls: 'bg-orchid/10 text-orchid' },
  webhook:     { icon: '⚡',  label: 'Webhook',    cls: 'bg-gold/10 text-gold' },
  reddit:      { icon: 'r',  label: 'Reddit',     cls: 'bg-[#FF4500]/10 text-[#FF6B35]' },
  manual:      { icon: '✎',  label: 'Manual',     cls: 'bg-mist/10 text-mist' },
  api:         { icon: '◉',  label: 'API',        cls: 'bg-aqua/10 text-aqua' },
};

export function SourceBadge({ source }: { source: string }) {
  const s = SOURCE_STYLES[source] ?? { icon: '?', label: source, cls: 'bg-mist/10 text-mist' };
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-500', s.cls)}>
      <span className="text-[9px] uppercase">{s.icon}</span>
      {s.label}
    </span>
  );
}

// ── Generic badge ───────────────────────────────────────────────────────────

type BadgeVariant = 'gold' | 'aqua' | 'orchid' | 'jade' | 'crimson' | 'tangerine' | 'mist' | 'default';

const BADGE_VARIANTS: Record<BadgeVariant, string> = {
  gold:       'bg-gold/10 text-gold ring-1 ring-gold/20',
  aqua:       'bg-aqua/10 text-aqua ring-1 ring-aqua/20',
  orchid:     'bg-orchid/10 text-orchid ring-1 ring-orchid/20',
  jade:       'bg-jade/10 text-jade ring-1 ring-jade/20',
  crimson:    'bg-crimson/10 text-crimson ring-1 ring-crimson/20',
  tangerine:  'bg-tangerine/10 text-tangerine ring-1 ring-tangerine/20',
  mist:       'bg-mist/10 text-mist ring-1 ring-mist/20',
  default:    'bg-ink/5 text-mist ring-1 ring-ink/10',
};

export function Badge({
  variant = 'default',
  className,
  children,
}: {
  variant?: BadgeVariant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium',
        BADGE_VARIANTS[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

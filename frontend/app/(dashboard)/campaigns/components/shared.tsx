'use client';

import { cn } from '@/lib/utils';
import type { OutreachTone, ApprovalMode } from '@/models';
import {
  CAMPAIGN_APPROVAL_MODES,
  CAMPAIGN_TONES,
} from '@/constants';

// ── inputCls ─────────────────────────────────────────────────────────────────

export const inputCls =
  'w-full rounded-lg border border-ink/[0.06] bg-elevated px-3 py-2 font-mono text-[12px] text-ink focus:border-aqua/30 focus:outline-none placeholder:text-dusk';

// ── FormSection ───────────────────────────────────────────────────────────────

export function FormSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-mono text-[11px] font-500 text-mist uppercase tracking-wider">{title}</span>
        <div className="flex-1 h-px bg-ink/[0.06]" />
      </div>
      {children}
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────

export function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="section-label mb-1.5 block">
        {label}{required && <span className="text-crimson ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

// ── RadioPill ─────────────────────────────────────────────────────────────────

export function RadioPill({
  selected,
  onClick,
  children,
  color = 'aqua',
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: 'aqua' | 'gold' | 'orchid';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition-colors',
        selected && color === 'aqua'   && 'border-aqua/30 bg-aqua/10 text-aqua',
        selected && color === 'gold'   && 'border-gold/30 bg-gold/10 text-gold',
        selected && color === 'orchid' && 'border-orchid/30 bg-orchid/10 text-orchid',
        !selected && 'border-ink/[0.06] bg-elevated text-dusk hover:text-mist',
      )}
    >
      {children}
    </button>
  );
}

// ── ToggleChip ────────────────────────────────────────────────────────────────

export function ToggleChip({
  selected,
  onClick,
  children,
  color = 'aqua',
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: 'aqua' | 'orchid';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition-colors',
        selected && color === 'aqua'   && 'border-aqua/30 bg-aqua/10 text-aqua',
        selected && color === 'orchid' && 'border-orchid/30 bg-orchid/10 text-orchid',
        !selected && 'border-ink/[0.06] bg-elevated text-dusk hover:text-mist',
      )}
    >
      {children}
    </button>
  );
}

// ── ToneSelector ──────────────────────────────────────────────────────────────

export function ToneSelector({
  value,
  onChange,
}: {
  value: OutreachTone | undefined;
  onChange: (tone: OutreachTone) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {CAMPAIGN_TONES.map(({ id, label }) => (
        <RadioPill key={id} selected={value === id} onClick={() => onChange(id)} color="gold">
          {label}
        </RadioPill>
      ))}
    </div>
  );
}

// ── ApprovalModeSelector ──────────────────────────────────────────────────────

export function ApprovalModeSelector({
  value,
  onChange,
}: {
  value: ApprovalMode | undefined;
  onChange: (mode: ApprovalMode) => void;
}) {
  return (
    <div className="space-y-1.5">
      {CAMPAIGN_APPROVAL_MODES.map(({ id, label, desc }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            'w-full flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors',
            value === id
              ? 'border-jade/30 bg-jade/10'
              : 'border-ink/[0.06] bg-elevated hover:border-ink/10',
          )}
        >
          <div>
            <span className={cn('font-mono text-[11px] font-500', value === id ? 'text-jade' : 'text-mist')}>
              {label}
            </span>
            <p className="font-mono text-[10px] text-dusk">{desc}</p>
          </div>
          {value === id && (
            <div className="h-4 w-4 rounded-full border-2 border-jade bg-jade/20 flex items-center justify-center shrink-0">
              <div className="h-1.5 w-1.5 rounded-full bg-jade" />
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

export function EmptyState({
  icon: Icon,
  label,
  sub,
}: {
  icon: React.FC<{ className?: string }>;
  label: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-2">
      <Icon className="h-8 w-8 text-dusk" />
      <p className="font-mono text-[12px] text-mist">{label}</p>
      {sub && <p className="font-mono text-[10px] text-dusk">{sub}</p>}
    </div>
  );
}

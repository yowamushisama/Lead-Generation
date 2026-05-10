'use client';

import { useState, useEffect } from 'react';
import { X, RotateCcw, ChevronDown, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LeadStatus, LeadTier, LeadSource } from '@/models';
import { ALL_STATUSES, STATUS_LABELS, SOURCE_OPTIONS } from '@/constants/leads';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DrawerFilters {
  statuses: LeadStatus[];
  tiers: LeadTier[];
  sources: LeadSource[];
  role: string;
  minScore: number;
  maxScore: number;
  minRating: number | undefined;
  minReviewCount: string;
  industry: string;
  location: string;
  hasEmail: 'any' | 'yes' | 'no';
  hasPhone: 'any' | 'yes' | 'no';
  createdAfter: string;
  createdBefore: string;
  includeOptedOut: boolean;
}

export const DRAWER_DEFAULTS: DrawerFilters = {
  statuses: [],
  tiers: [],
  sources: [],
  role: '',
  minScore: 0,
  maxScore: 100,
  minRating: undefined,
  minReviewCount: '',
  industry: '',
  location: '',
  hasEmail: 'any',
  hasPhone: 'any',
  createdAfter: '',
  createdBefore: '',
  includeOptedOut: false,
};

export function countDrawerFilters(f: DrawerFilters): number {
  let n = 0;
  if (f.statuses.length) n++;
  if (f.tiers.length) n++;
  if (f.sources.length) n++;
  if (f.role) n++;
  if (f.minScore > 0 || f.maxScore < 100) n++;
  if (f.minRating !== undefined) n++;
  if (f.minReviewCount) n++;
  if (f.industry) n++;
  if (f.location) n++;
  if (f.hasEmail !== 'any') n++;
  if (f.hasPhone !== 'any') n++;
  if (f.createdAfter) n++;
  if (f.createdBefore) n++;
  if (f.includeOptedOut) n++;
  return n;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 font-mono text-[11px] font-500 text-ink/55">{children}</p>
  );
}

function Section({
  title,
  children,
  defaultOpen = true,
  accent,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  accent?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-ink/[0.07]">
      <button
        className="flex w-full items-center justify-between px-5 py-3.5 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          {accent && (
            <span className={cn('h-1.5 w-1.5 rounded-full', accent)} />
          )}
          <span className="font-mono text-[11px] font-600 uppercase tracking-wider text-ink/70">
            {title}
          </span>
        </div>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-ink/40 transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

function MultiChip<T extends string>({
  options,
  selected,
  onToggle,
}: {
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(({ value, label }) => {
        const active = selected.includes(value);
        return (
          <button
            key={value}
            onClick={() => onToggle(value)}
            className={cn(
              'rounded-md border px-2.5 py-1 font-mono text-[10px] font-500 transition-all duration-150',
              active
                ? 'border-aqua/50 bg-aqua/10 text-aqua shadow-[0_0_0_1px_rgba(0,200,200,0.12)]'
                : 'border-ink/[0.12] bg-ink/[0.03] text-ink/50 hover:border-ink/25 hover:bg-ink/[0.06] hover:text-ink/80',
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function ScoreRange({
  min,
  max,
  onChange,
}: {
  min: number;
  max: number;
  onChange: (min: number, max: number) => void;
}) {
  return (
    <div className="space-y-3">
      {/* Track */}
      <div className="relative h-1.5 rounded-full bg-ink/[0.10]">
        <div
          className="absolute h-full rounded-full bg-aqua/50 transition-all duration-100"
          style={{ left: `${min}%`, right: `${100 - max}%` }}
        />
      </div>
      {/* Controls */}
      <div className="flex items-end gap-4">
        <div className="flex-1 space-y-1.5">
          <label className="block font-mono text-[9px] uppercase tracking-wider text-ink/40">Min score</label>
          <input
            type="range"
            min={0} max={100} step={5}
            value={min}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v <= max - 5) onChange(v, max);
            }}
            className="w-full cursor-pointer accent-[hsl(180,80%,50%)]"
          />
          <div className="rounded-md bg-ink/[0.06] py-0.5 text-center font-mono text-[12px] font-600 text-aqua">
            {min}
          </div>
        </div>
        <div className="flex-1 space-y-1.5">
          <label className="block font-mono text-[9px] uppercase tracking-wider text-ink/40">Max score</label>
          <input
            type="range"
            min={0} max={100} step={5}
            value={max}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v >= min + 5) onChange(min, v);
            }}
            className="w-full cursor-pointer accent-[hsl(180,80%,50%)]"
          />
          <div className="rounded-md bg-ink/[0.06] py-0.5 text-center font-mono text-[12px] font-600 text-aqua">
            {max}
          </div>
        </div>
      </div>
    </div>
  );
}

function StarRating({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((v) => (
        <button
          key={v}
          onClick={() => onChange(v === value ? undefined : v)}
          className="transition-transform hover:scale-110 active:scale-95"
        >
          <Star
            className={cn(
              'h-5 w-5 transition-colors',
              value !== undefined && v <= value ? 'text-gold' : 'text-ink/20 hover:text-ink/40',
            )}
            fill={value !== undefined && v <= value ? 'currentColor' : 'none'}
          />
        </button>
      ))}
      <span className="ml-2 font-mono text-[10px] text-ink/45">
        {value !== undefined ? `${value}+ stars` : 'Any rating'}
      </span>
    </div>
  );
}

function TriState({
  value,
  onChange,
}: {
  value: 'any' | 'yes' | 'no';
  onChange: (v: 'any' | 'yes' | 'no') => void;
}) {
  const opts = [
    { v: 'any' as const, label: 'Any' },
    { v: 'yes' as const, label: 'Yes' },
    { v: 'no'  as const, label: 'No'  },
  ] as const;
  return (
    <div className="flex overflow-hidden rounded-lg border border-ink/[0.10]">
      {opts.map(({ v, label }, i) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={cn(
            'flex-1 py-1.5 font-mono text-[11px] font-500 transition-colors',
            i < opts.length - 1 && 'border-r border-ink/[0.10]',
            value === v
              ? 'bg-aqua/10 text-aqua'
              : 'text-ink/50 hover:bg-ink/[0.05] hover:text-ink/80',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-9 w-full rounded-lg border border-ink/[0.10] bg-ink/[0.03] px-3 font-mono text-[11px] text-ink placeholder:text-ink/25 focus:border-aqua/40 focus:bg-aqua/[0.02] focus:outline-none focus:ring-1 focus:ring-aqua/20 transition-colors"
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const TIER_CHIPS: { value: LeadTier; label: string }[] = [
  { value: 'HOT',  label: '🔥 HOT'  },
  { value: 'WARM', label: '🌤 WARM' },
  { value: 'COLD', label: '🧊 COLD' },
];

const STATUS_CHIPS = ALL_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }));

export function FilterDrawer({
  open,
  onClose,
  initial,
  onApply,
  collapsedByDefault = false,
}: {
  open: boolean;
  onClose: () => void;
  initial: DrawerFilters;
  onApply: (filters: DrawerFilters) => void;
  /** When true (e.g. inside campaigns), all sections start collapsed */
  collapsedByDefault?: boolean;
}) {
  const [draft, setDraft] = useState<DrawerFilters>(initial);

  useEffect(() => {
    if (open) setDraft(initial);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function patch(updates: Partial<DrawerFilters>) {
    setDraft((prev) => ({ ...prev, ...updates }));
  }

  function toggleArr<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
  }

  const activeCount = countDrawerFilters(draft);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px] transition-opacity duration-300',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={cn(
          'fixed right-0 top-0 bottom-0 z-50 flex w-[21rem] flex-col',
          'border-l border-ink/[0.10] bg-surface shadow-[−4px_0_32px_rgba(0,0,0,0.4)]',
          'transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* ── Header: always visible, contains actions ── */}
        <div className="flex shrink-0 flex-col gap-0 border-b border-ink/[0.10]">
          {/* Row 1: title + close */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="font-display text-[13px] font-700 text-ink">Filters</span>
              {activeCount > 0 && (
                <span className="rounded-full bg-aqua/20 px-2 py-0.5 font-mono text-[10px] font-700 text-aqua">
                  {activeCount}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-ink/40 transition-colors hover:bg-ink/[0.07] hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Row 2: action buttons */}
          <div className="flex items-center gap-2 border-t border-ink/[0.06] px-5 py-2.5">
            <button
              onClick={() => setDraft(DRAWER_DEFAULTS)}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-[11px] text-ink/45 transition-colors hover:bg-ink/[0.05] hover:text-ink/70"
            >
              <RotateCcw className="h-3 w-3" />
              Reset all
            </button>
            <div className="flex-1" />
            <button
              onClick={onClose}
              className="h-8 rounded-lg border border-ink/[0.12] px-3.5 font-mono text-[11px] text-ink/55 transition-colors hover:border-ink/25 hover:text-ink"
            >
              Cancel
            </button>
            <button
              onClick={() => onApply(draft)}
              className={cn(
                'h-8 rounded-lg border px-4 font-mono text-[11px] font-600 transition-all',
                activeCount > 0
                  ? 'border-aqua/40 bg-aqua/10 text-aqua hover:bg-aqua/[0.18] shadow-[0_0_0_1px_rgba(0,200,200,0.08)]'
                  : 'border-ink/[0.12] bg-ink/[0.04] text-ink/50 hover:border-ink/25 hover:text-ink/80',
              )}
            >
              {activeCount > 0 ? `Apply · ${activeCount}` : 'Apply'}
            </button>
          </div>
        </div>

        {/* ── Scrollable filter sections ── */}
        <div className="flex-1 overflow-y-auto">

          {/* Score & Quality */}
          <Section title="Score & Quality" accent="bg-aqua/70" defaultOpen={!collapsedByDefault}>
            <div className="space-y-5">
              <div>
                <FieldLabel>Score range</FieldLabel>
                <ScoreRange
                  min={draft.minScore}
                  max={draft.maxScore}
                  onChange={(min, max) => patch({ minScore: min, maxScore: max })}
                />
              </div>
              <div>
                <FieldLabel>Tier</FieldLabel>
                <MultiChip
                  options={TIER_CHIPS}
                  selected={draft.tiers}
                  onToggle={(v) => patch({ tiers: toggleArr(draft.tiers, v) })}
                />
              </div>
              <div>
                <FieldLabel>Min rating (Google Maps)</FieldLabel>
                <StarRating value={draft.minRating} onChange={(v) => patch({ minRating: v })} />
              </div>
              <div>
                <FieldLabel>Min review count</FieldLabel>
                <input
                  type="number"
                  min={0}
                  value={draft.minReviewCount}
                  onChange={(e) => patch({ minReviewCount: e.target.value })}
                  placeholder="e.g. 10"
                  className="h-9 w-full rounded-lg border border-ink/[0.10] bg-ink/[0.03] px-3 font-mono text-[11px] text-ink placeholder:text-ink/25 focus:border-aqua/40 focus:outline-none focus:ring-1 focus:ring-aqua/20 transition-colors"
                />
              </div>
            </div>
          </Section>

          {/* Status & Lifecycle */}
          <Section title="Status & Lifecycle" accent="bg-gold/60" defaultOpen={!collapsedByDefault}>
            <div className="space-y-4">
              <MultiChip
                options={STATUS_CHIPS}
                selected={draft.statuses}
                onToggle={(v) => patch({ statuses: toggleArr(draft.statuses, v) })}
              />
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-ink/[0.08] px-3 py-2.5 transition-colors hover:border-ink/[0.14]">
                <input
                  type="checkbox"
                  checked={draft.includeOptedOut}
                  onChange={(e) => patch({ includeOptedOut: e.target.checked })}
                  className="h-3.5 w-3.5 accent-[hsl(180,80%,50%)]"
                />
                <span className="font-mono text-[11px] text-ink/60">Include opted-out leads</span>
              </label>
            </div>
          </Section>

          {/* Source & Role */}
          <Section title="Source & Role" accent="bg-tangerine/60" defaultOpen={!collapsedByDefault}>
            <div className="space-y-4">
              <div>
                <FieldLabel>Source</FieldLabel>
                <MultiChip
                  options={SOURCE_OPTIONS}
                  selected={draft.sources}
                  onToggle={(v) => patch({ sources: toggleArr(draft.sources, v) })}
                />
              </div>
              <div>
                <FieldLabel>Role / title</FieldLabel>
                <TextInput
                  value={draft.role}
                  onChange={(v) => patch({ role: v })}
                  placeholder="e.g. CEO, Marketing Director"
                />
              </div>
            </div>
          </Section>

          {/* Firmographics */}
          <Section title="Firmographics" defaultOpen={false} accent="bg-mist/40">
            <div className="space-y-3">
              <div>
                <FieldLabel>Industry</FieldLabel>
                <TextInput
                  value={draft.industry}
                  onChange={(v) => patch({ industry: v })}
                  placeholder="e.g. SaaS, Healthcare"
                />
              </div>
              <div>
                <FieldLabel>Location</FieldLabel>
                <TextInput
                  value={draft.location}
                  onChange={(v) => patch({ location: v })}
                  placeholder="e.g. New York, London"
                />
              </div>
            </div>
          </Section>

          {/* Contactability */}
          <Section title="Contactability" defaultOpen={false} accent="bg-aqua/40">
            <div className="space-y-3">
              <div>
                <FieldLabel>Has email</FieldLabel>
                <TriState value={draft.hasEmail} onChange={(v) => patch({ hasEmail: v })} />
              </div>
              <div>
                <FieldLabel>Has phone</FieldLabel>
                <TriState value={draft.hasPhone} onChange={(v) => patch({ hasPhone: v })} />
              </div>
            </div>
          </Section>

          {/* Date Range */}
          <Section title="Date Added" defaultOpen={false} accent="bg-mist/30">
            <div className="space-y-3">
              <div>
                <FieldLabel>After</FieldLabel>
                <input
                  type="date"
                  value={draft.createdAfter}
                  onChange={(e) => patch({ createdAfter: e.target.value })}
                  className="h-9 w-full rounded-lg border border-ink/[0.10] bg-ink/[0.03] px-3 font-mono text-[11px] text-ink focus:border-aqua/40 focus:outline-none focus:ring-1 focus:ring-aqua/20 transition-colors [color-scheme:dark]"
                />
              </div>
              <div>
                <FieldLabel>Before</FieldLabel>
                <input
                  type="date"
                  value={draft.createdBefore}
                  onChange={(e) => patch({ createdBefore: e.target.value })}
                  className="h-9 w-full rounded-lg border border-ink/[0.10] bg-ink/[0.03] px-3 font-mono text-[11px] text-ink focus:border-aqua/40 focus:outline-none focus:ring-1 focus:ring-aqua/20 transition-colors [color-scheme:dark]"
                />
              </div>
            </div>
          </Section>

          {/* Bottom breathing room */}
          <div className="h-4" />
        </div>
      </div>
    </>
  );
}

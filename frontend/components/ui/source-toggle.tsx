'use client';

import { cn } from '@/lib/utils';

export type SourceTab = 'all' | 'linkedin' | 'google_maps' | 'csv' | 'webhook';

const TABS: { id: SourceTab; label: string; abbr: string }[] = [
  { id: 'all',         label: 'All Sources',  abbr: 'ALL' },
  { id: 'linkedin',    label: 'LinkedIn',     abbr: 'IN' },
  { id: 'google_maps', label: 'Google Maps',  abbr: 'MAPS' },
  { id: 'csv',         label: 'CSV Import',   abbr: 'CSV' },
  { id: 'webhook',     label: 'Webhook',      abbr: 'WH' },
];

export function SourceToggle({
  value,
  onChange,
  counts,
}: {
  value: SourceTab;
  onChange: (v: SourceTab) => void;
  counts?: Partial<Record<SourceTab, number>>;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-ink/[0.06] bg-surface p-1">
      {TABS.map((tab) => {
        const active = value === tab.id;
        const count = counts?.[tab.id];
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-all duration-150',
              'font-mono text-[11px] font-500 uppercase tracking-wider',
              active
                ? 'bg-aqua/10 text-aqua ring-1 ring-aqua/20'
                : 'text-mist hover:bg-ink/[0.04] hover:text-ink',
            )}
          >
            {tab.abbr}
            {count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[9px] font-600',
                  active ? 'bg-aqua/20 text-aqua' : 'bg-ink/[0.06] text-mist',
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

'use client';

import { cn, relativeTime } from '@/lib/utils';
import type { AdapterId, AdapterMeta } from './adapter-types';
import { STATUS_LABELS } from './adapter-types';

// ── AdapterStatsRow ────────────────────────────────────────────────────────────
// Four clickable mini-cards that show each adapter's status and lead count.
// Clicking a card selects that adapter for the detail panel below.

export function AdapterStatsRow({
  adapters,
  selected,
  onSelect,
}: {
  adapters: AdapterMeta[];
  selected: AdapterId;
  onSelect: (id: AdapterId) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {adapters.map((adapter) => {
        const Icon = adapter.icon;
        const statusInfo = STATUS_LABELS[adapter.status];
        const isSelected = selected === adapter.id;

        return (
          <button
            key={adapter.id}
            onClick={() => onSelect(adapter.id)}
            className={cn(
              'rounded-xl border p-3 text-left transition-all duration-150 hover:bg-surface',
              isSelected ? 'border-opacity-20 bg-surface' : 'border-ink/[0.06] bg-base',
            )}
            style={
              isSelected
                ? { borderColor: `${adapter.color}30`, background: `${adapter.color}05` }
                : {}
            }
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                style={{ background: `${adapter.color}15`, color: adapter.color }}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              <span className="font-mono text-[11px] font-500 text-ink truncate">
                {adapter.label}
              </span>
            </div>

            <div className="flex items-center gap-1 mb-1">
              <span className={statusInfo.dot} style={{ width: 6, height: 6 }} />
              <span className={cn('font-mono text-[9px]', statusInfo.text)}>
                {statusInfo.label}
              </span>
            </div>

            <p className="font-mono text-[10px] text-mist">
              {adapter.leadsIngested.toLocaleString()} leads
            </p>

            {adapter.lastRun && (
              <p className="font-mono text-[9px] text-mist mt-0.5">
                {relativeTime(adapter.lastRun)}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}

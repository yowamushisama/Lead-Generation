'use client';

import { Lock, RotateCcw } from 'lucide-react';
import { type ColId, OPTIONAL_COLS, DEFAULT_VISIBILITY } from '@/constants/lead-columns';
import { cn } from '@/lib/utils';

const FIXED_COL_LABELS = ['Name / Company', 'Score', 'Tier', 'Status'];

export function ColumnPicker({
  visible,
  onToggle,
  onReset,
}: {
  visible: Record<ColId, boolean>;
  onToggle: (id: ColId) => void;
  onReset: () => void;
}) {
  const activeCount = OPTIONAL_COLS.filter((c) => visible[c.id]).length;
  const isDefault = OPTIONAL_COLS.every((c) => visible[c.id] === DEFAULT_VISIBILITY[c.id]);

  return (
    <div className="absolute right-0 top-11 z-50 w-64 rounded-xl border border-ink/[0.12] bg-overlay shadow-[0_8px_32px_rgba(0,0,0,0.24)] overflow-hidden">

      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-ink/[0.08] bg-surface/60">
        <span className="font-mono text-[11px] font-600 text-ink">Columns</span>
        <span className="font-mono text-[10px] text-mist">{activeCount + FIXED_COL_LABELS.length} visible</span>
        <button
          onClick={onReset}
          disabled={isDefault}
          className={cn(
            'ml-auto flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-[10px] font-500 transition-colors',
            isDefault
              ? 'border-ink/[0.06] text-ink/25 cursor-not-allowed'
              : 'border-ink/[0.14] text-ink/70 hover:border-ink/30 hover:text-ink hover:bg-ink/[0.04]',
          )}
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
      </div>

      <div className="max-h-[420px] overflow-y-auto">

        <div className="mx-2 mt-2 mb-1 rounded-lg border border-ink/[0.10] bg-ink/[0.04]">
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-ink/[0.08]">
            <Lock className="h-3 w-3 text-mist" />
            <span className="font-mono text-[10px] font-700 text-mist tracking-wide">Fixed — always shown</span>
          </div>
          {FIXED_COL_LABELS.map((label) => (
            <div key={label} className="flex items-center gap-2.5 px-3 py-1.5">
              <div className="h-3.5 w-3.5 shrink-0 rounded border border-ink/20 bg-ink/[0.08] flex items-center justify-center">
                <Lock className="h-2 w-2 text-mist/60" />
              </div>
              <span className="font-mono text-[11px] text-ink/70">{label}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 px-3 py-2">
          <div className="h-px flex-1 bg-ink/[0.08]" />
          <span className="font-mono text-[9px] font-700 uppercase tracking-widest text-ink/40">Optional</span>
          <div className="h-px flex-1 bg-ink/[0.08]" />
        </div>

        <div className="px-2 pb-2">
          <div className="space-y-0.5">
            {OPTIONAL_COLS.map((col) => (
              <label
                key={col.id}
                className="flex items-center gap-2.5 px-1.5 py-1 rounded cursor-pointer hover:bg-ink/[0.05] group"
              >
                <input
                  type="checkbox"
                  checked={visible[col.id]}
                  onChange={() => onToggle(col.id)}
                  className="h-3.5 w-3.5 shrink-0 rounded border-ink/30 bg-surface accent-aqua cursor-pointer"
                />
                <span className={cn(
                  'font-mono text-[10px] transition-colors',
                  visible[col.id] ? 'text-ink' : 'text-mist',
                )}>
                  {col.label}
                </span>
                {visible[col.id] && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-aqua shrink-0" />
                )}
              </label>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

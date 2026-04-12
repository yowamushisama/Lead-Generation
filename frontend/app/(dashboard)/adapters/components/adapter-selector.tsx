'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AdapterId } from './adapter-types';
import { ADAPTERS } from './adapter-types';

// ── AdapterSelector ────────────────────────────────────────────────────────────
// Custom dropdown (not native <select>) so it can match the dark design system.
// Closes on outside click via a mousedown listener bound only while open.

export function AdapterSelector({
  selected,
  onChange,
}: {
  selected: AdapterId;
  onChange: (id: AdapterId) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const current = ADAPTERS.find((a) => a.id === selected)!;
  const CurrentIcon = current.icon;

  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open]);

  return (
    <div ref={containerRef} className="relative w-72">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 rounded-xl border border-ink/[0.06] bg-elevated px-3 py-2.5 transition-colors hover:bg-overlay"
      >
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ background: `${current.color}15`, color: current.color }}
        >
          <CurrentIcon className="h-4 w-4" />
        </div>
        <span className="flex-1 text-left font-mono text-[12px] text-ink">{current.label}</span>
        <ChevronDown
          className={cn('h-4 w-4 text-dusk transition-transform duration-150', open && 'rotate-180')}
        />
      </button>

      {/* Option list */}
      {open && (
        <>
          {/* Backdrop to close on click outside the list itself */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1.5 w-full rounded-xl border border-ink/[0.06] bg-elevated shadow-xl overflow-hidden">
            {ADAPTERS.map((adapter) => {
              const AdIcon = adapter.icon;
              const isSelected = selected === adapter.id;
              return (
                <button
                  key={adapter.id}
                  onClick={() => { onChange(adapter.id); setOpen(false); }}
                  className={cn(
                    'flex w-full items-center gap-3 px-3 py-2.5 transition-colors',
                    isSelected ? 'bg-aqua/5' : 'hover:bg-overlay',
                  )}
                >
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                    style={{ background: `${adapter.color}15`, color: adapter.color }}
                  >
                    <AdIcon className="h-3.5 w-3.5" />
                  </div>
                  <span className="font-mono text-[11px] text-ink flex-1 text-left">
                    {adapter.label}
                  </span>
                  {isSelected && <Check className="h-3 w-3 text-aqua" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

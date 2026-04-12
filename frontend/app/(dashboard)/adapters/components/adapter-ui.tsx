'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TagAccent } from './adapter-types';
import { TAG_ACCENT_CLASSES } from './adapter-types';

// ── TagInputMulti ──────────────────────────────────────────────────────────────
// Tag pill input: comma or Enter to add, × to remove each tag.
// accent controls the pill color using the project's design tokens.

export function TagInputMulti({
  label,
  tags,
  onChange,
  placeholder,
  accent = 'aqua',
}: {
  label: string;
  tags: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  accent?: TagAccent;
}) {
  const [input, setInput] = useState('');
  const tagClass = TAG_ACCENT_CLASSES[accent];

  function addTag() {
    const trimmed = input.trim().replace(/,$/, '');
    if (!trimmed) return;
    onChange([...tags, trimmed]);
    setInput('');
  }

  return (
    <div>
      <label className="section-label mb-1.5 block">{label}</label>
      <div className="rounded-lg border border-ink/[0.06] bg-elevated p-2 min-h-[60px]">
        <div className="flex flex-wrap gap-1 mb-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className={cn('flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px]', tagClass)}
            >
              {tag}
              <button onClick={() => onChange(tags.filter((t) => t !== tag))}>
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
          }}
          className="w-full bg-transparent font-mono text-[11px] text-ink placeholder:text-dusk focus:outline-none"
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}

// ── FormField ─────────────────────────────────────────────────────────────────
// Wraps any input with a consistent label above it.

export function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="section-label block">{label}</label>
      {children}
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────
// Inline pill toggle switch with label, reused across CSV and LinkedIn panels.

export function Toggle({
  checked,
  onChange,
  label,
  activeColor = 'bg-jade/60',
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  activeColor?: string;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-4 w-7 rounded-full transition-colors',
          checked ? activeColor : 'bg-ink/[0.15]',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform',
            checked ? 'translate-x-0' : '-translate-x-3.5',
          )}
        />
      </button>
      <span className="font-mono text-[11px] text-mist">{label}</span>
    </label>
  );
}

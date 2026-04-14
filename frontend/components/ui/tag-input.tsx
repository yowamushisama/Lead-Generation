'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

// ── Multi-value TagInput ───────────────────────────────────────────────────────

function TagInputMulti({
  label,
  tags,
  onChange,
  placeholder,
}: {
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');

  const addTag = () => {
    const trimmed = input.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    onChange([...tags, trimmed]);
    setInput('');
  };

  return (
    <div>
      <label className="section-label mb-1.5 block">{label}</label>
      <div className="rounded-lg border border-ink/[0.06] bg-elevated p-2 min-h-[60px]">
        <div className="flex flex-wrap gap-1 mb-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 rounded-md bg-aqua/10 px-2 py-0.5 font-mono text-[10px] text-aqua"
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(tags.filter((t) => t !== tag))}
                className="hover:text-crimson transition-colors"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              addTag();
            }
            if (e.key === 'Backspace' && !input && tags.length) {
              onChange(tags.slice(0, -1));
            }
          }}
          className="w-full bg-transparent font-mono text-[11px] text-ink placeholder:text-mist/60 focus:outline-none"
          placeholder={tags.length === 0 ? placeholder : 'Add another…'}
        />
      </div>
    </div>
  );
}

// ── Single-value TagInput ─────────────────────────────────────────────────────

function TagInputSingle({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="section-label mb-1.5 block">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-ink/[0.06] bg-elevated px-3 py-2 font-mono text-[12px] text-ink focus:border-aqua/30 focus:outline-none placeholder:text-dusk"
        placeholder={placeholder}
      />
    </div>
  );
}

// ── Unified export ────────────────────────────────────────────────────────────

type TagInputProps =
  | {
      single: true;
      label: string;
      value: string;
      onChange: (v: string) => void;
      placeholder?: string;
    }
  | {
      single?: false;
      label: string;
      tags: string[];
      onChange: (tags: string[]) => void;
      placeholder?: string;
    };

export function TagInput(props: TagInputProps) {
  if (props.single) {
    return (
      <TagInputSingle
        label={props.label}
        value={props.value}
        onChange={props.onChange}
        placeholder={props.placeholder}
      />
    );
  }
  return (
    <TagInputMulti
      label={props.label}
      tags={props.tags}
      onChange={props.onChange}
      placeholder={props.placeholder}
    />
  );
}

'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle, RotateCcw } from 'lucide-react';
import { FormSection, Field, inputCls } from '../../components/shared';
import { cn } from '@/lib/utils';
import type { UpsertPromptConfigDto } from '@/models';

interface Props {
  form: UpsertPromptConfigDto;
  onChange: (patch: Partial<UpsertPromptConfigDto>) => void;
}

export function AdvancedOverridesSection({ form, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const hasOverrides =
    !!form.personalizationPromptOverride || !!form.outreachPromptOverride;

  return (
    <div className="rounded-xl border border-ink/[0.06] bg-surface">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <div className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
          hasOverrides ? 'bg-tangerine/10' : 'bg-elevated',
        )}>
          <AlertTriangle className={cn('h-3.5 w-3.5', hasOverrides ? 'text-tangerine' : 'text-dusk')} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[11px] font-500 text-mist uppercase tracking-wider">
            Advanced Overrides
          </p>
          <p className="font-mono text-[10px] text-dusk mt-0.5">
            {hasOverrides
              ? 'Custom system prompts active — these replace the defaults entirely'
              : 'Replace entire system prompts — use with caution'}
          </p>
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-dusk shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-dusk shrink-0" />
        )}
      </button>

      {open && (
        <div className="border-t border-ink/[0.06] p-4 space-y-4">
          <div className="rounded-lg border border-tangerine/20 bg-tangerine/[0.04] p-3">
            <p className="font-mono text-[10px] text-tangerine">
              Warning: These fields replace the entire system prompt for the respective stage.
              All built-in rules (word count, anti-spam, formatting) are bypassed.
              Only use if you have a very specific prompt requirement.
            </p>
          </div>

          <Field label="Personalization System Prompt Override">
            <div className="relative">
              <textarea
                value={form.personalizationPromptOverride ?? ''}
                onChange={(e) => onChange({ personalizationPromptOverride: e.target.value })}
                className={`${inputCls} resize-none font-mono text-[10px]`}
                rows={6}
                placeholder="Paste your full custom personalization system prompt here…"
              />
              {form.personalizationPromptOverride && (
                <button
                  type="button"
                  onClick={() => onChange({ personalizationPromptOverride: '' })}
                  className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-elevated px-2 py-1 font-mono text-[10px] text-dusk hover:text-crimson transition-colors"
                >
                  <RotateCcw className="h-2.5 w-2.5" />
                  Reset
                </button>
              )}
            </div>
          </Field>

          <Field label="Outreach System Prompt Override">
            <div className="relative">
              <textarea
                value={form.outreachPromptOverride ?? ''}
                onChange={(e) => onChange({ outreachPromptOverride: e.target.value })}
                className={`${inputCls} resize-none font-mono text-[10px]`}
                rows={6}
                placeholder="Paste your full custom outreach system prompt here…"
              />
              {form.outreachPromptOverride && (
                <button
                  type="button"
                  onClick={() => onChange({ outreachPromptOverride: '' })}
                  className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-elevated px-2 py-1 font-mono text-[10px] text-dusk hover:text-crimson transition-colors"
                >
                  <RotateCcw className="h-2.5 w-2.5" />
                  Reset
                </button>
              )}
            </div>
          </Field>
        </div>
      )}
    </div>
  );
}

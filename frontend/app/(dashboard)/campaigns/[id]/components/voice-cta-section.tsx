'use client';

import { Mic2 } from 'lucide-react';
import { FormSection, Field, RadioPill, inputCls } from '../../components/shared';
import type { UpsertPromptConfigDto } from '@/models';

const TONE_OPTIONS = [
  { id: 'professional', label: 'Professional' },
  { id: 'casual',       label: 'Casual' },
  { id: 'direct',       label: 'Direct' },
  { id: 'consultative', label: 'Consultative' },
  { id: 'custom',       label: 'Custom' },
] as const;

const CTA_OPTIONS = [
  { id: 'reply_question', label: 'Reply Question' },
  { id: 'book_call',      label: 'Book a Call' },
  { id: 'demo_request',   label: 'Demo Request' },
  { id: 'custom',         label: 'Custom' },
] as const;

interface Props {
  form: UpsertPromptConfigDto;
  onChange: (patch: Partial<UpsertPromptConfigDto>) => void;
}

export function VoiceCtaSection({ form, onChange }: Props) {
  const tone = form.preferredTone ?? 'professional';
  const cta  = form.ctaStyle ?? 'reply_question';

  return (
    <FormSection icon={<Mic2 className="h-3.5 w-3.5 text-gold" />} title="Voice & CTA">
      <Field label="Outreach Tone">
        <div className="flex flex-wrap gap-2 mt-1">
          {TONE_OPTIONS.map(({ id, label }) => (
            <RadioPill
              key={id}
              selected={tone === id}
              onClick={() => onChange({ preferredTone: id })}
              color="gold"
            >
              {label}
            </RadioPill>
          ))}
        </div>
      </Field>

      {tone === 'custom' && (
        <Field label="Custom Tone Instructions">
          <textarea
            value={form.customToneInstructions ?? ''}
            onChange={(e) => onChange({ customToneInstructions: e.target.value })}
            className={`${inputCls} resize-none`}
            rows={2}
            placeholder="Describe exactly how the message should sound…"
          />
        </Field>
      )}

      <Field label="CTA Style">
        <div className="flex flex-wrap gap-2 mt-1">
          {CTA_OPTIONS.map(({ id, label }) => (
            <RadioPill
              key={id}
              selected={cta === id}
              onClick={() => onChange({ ctaStyle: id })}
              color="aqua"
            >
              {label}
            </RadioPill>
          ))}
        </div>
      </Field>

      {cta === 'custom' && (
        <Field label="Custom CTA Text">
          <input
            value={form.customCta ?? ''}
            onChange={(e) => onChange({ customCta: e.target.value })}
            className={inputCls}
            placeholder='e.g. "Want me to send over a 2-min Loom?"'
          />
        </Field>
      )}
    </FormSection>
  );
}

'use client';

import { Target } from 'lucide-react';
import { FormSection, Field, inputCls } from '../../components/shared';
import { TagInput } from '@/components/ui/tag-input';
import type { UpsertPromptConfigDto } from '@/models';

interface Props {
  form: UpsertPromptConfigDto;
  onChange: (patch: Partial<UpsertPromptConfigDto>) => void;
}

export function PositioningSection({ form, onChange }: Props) {
  return (
    <FormSection icon={<Target className="h-3.5 w-3.5 text-aqua" />} title="Positioning">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Company Description">
          <textarea
            value={form.companyDescription ?? ''}
            onChange={(e) => onChange({ companyDescription: e.target.value })}
            className={`${inputCls} resize-none`}
            rows={3}
            placeholder="What your company does in plain language…"
          />
        </Field>

        <Field label="Core Offer">
          <textarea
            value={form.coreOffer ?? ''}
            onChange={(e) => onChange({ coreOffer: e.target.value })}
            className={`${inputCls} resize-none`}
            rows={3}
            placeholder="The specific service or product you're selling…"
          />
        </Field>

        <Field label="Who It's For">
          <input
            value={form.targetPersona ?? ''}
            onChange={(e) => onChange({ targetPersona: e.target.value })}
            className={inputCls}
            placeholder="e.g. Series-A SaaS founders scaling past $1M ARR"
          />
        </Field>

        <Field label="Main Pain Solved">
          <input
            value={form.mainPainSolved ?? ''}
            onChange={(e) => onChange({ mainPainSolved: e.target.value })}
            className={inputCls}
            placeholder="e.g. Wasting 20h/week on manual lead qualification"
          />
        </Field>

        <Field label="Outcome Promised">
          <input
            value={form.mainOutcomePromised ?? ''}
            onChange={(e) => onChange({ mainOutcomePromised: e.target.value })}
            className={inputCls}
            placeholder="e.g. 3× reply rate in 30 days"
          />
        </Field>

        <div>
          <TagInput
            label="Proof Points"
            tags={form.proofPoints ?? []}
            onChange={(tags) => onChange({ proofPoints: tags })}
            placeholder="Case study, stat, or result…"
          />
        </div>
      </div>
    </FormSection>
  );
}

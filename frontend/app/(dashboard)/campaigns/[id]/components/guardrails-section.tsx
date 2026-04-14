'use client';

import { ShieldCheck } from 'lucide-react';
import { FormSection, Field, inputCls } from '../../components/shared';
import { TagInput } from '@/components/ui/tag-input';
import type { UpsertPromptConfigDto } from '@/models';

interface Props {
  form: UpsertPromptConfigDto;
  onChange: (patch: Partial<UpsertPromptConfigDto>) => void;
}

export function GuardrailsSection({ form, onChange }: Props) {
  const total =
    (form.forbiddenPhrases?.length ?? 0) +
    (form.forbiddenClaims?.length ?? 0) +
    (form.complianceNotes ? 1 : 0);

  return (
    <FormSection
      icon={<ShieldCheck className="h-3.5 w-3.5 text-jade" />}
      title={
        <span className="flex items-center gap-2">
          Guardrails
          {total > 0 && (
            <span className="rounded-full bg-jade/10 px-1.5 py-0.5 font-mono text-[9px] text-jade">
              {total} active
            </span>
          )}
        </span>
      }
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <TagInput
          label="Forbidden Phrases"
          tags={form.forbiddenPhrases ?? []}
          onChange={(tags) => onChange({ forbiddenPhrases: tags })}
          placeholder="I hope this finds you well…"
        />

        <TagInput
          label="Forbidden Claims"
          tags={form.forbiddenClaims ?? []}
          onChange={(tags) => onChange({ forbiddenClaims: tags })}
          placeholder="Industry-leading, award-winning…"
        />
      </div>

      <Field label="Compliance Notes">
        <textarea
          value={form.complianceNotes ?? ''}
          onChange={(e) => onChange({ complianceNotes: e.target.value })}
          className={`${inputCls} resize-none`}
          rows={2}
          placeholder="Legal or regulatory requirements to embed in every message…"
        />
      </Field>
    </FormSection>
  );
}

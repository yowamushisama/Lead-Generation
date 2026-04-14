'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Save, Dot, ArrowLeft, Clock } from 'lucide-react';
import { promptConfigs as promptConfigsApi } from '@/lib/api-client';
import type { UpsertPromptConfigDto, PromptConfig } from '@/models';
import { PositioningSection }       from '../../campaigns/[id]/components/positioning-section';
import { VoiceCtaSection }          from '../../campaigns/[id]/components/voice-cta-section';
import { GuardrailsSection }        from '../../campaigns/[id]/components/guardrails-section';
import { AdvancedOverridesSection } from '../../campaigns/[id]/components/advanced-overrides-section';
import { VersionHistory }           from '../../campaigns/[id]/components/version-history';
import { PreviewSandbox }           from '../../campaigns/[id]/components/preview-sandbox';

const inputCls =
  'w-full rounded-lg border border-ink/[0.06] bg-elevated px-3 py-2 font-mono text-[12px] text-ink focus:border-aqua/30 focus:outline-none placeholder:text-dusk';

function buildForm(config: PromptConfig | null | undefined): UpsertPromptConfigDto {
  if (!config) {
    return { preferredTone: 'professional', ctaStyle: 'reply_question', proofPoints: [], forbiddenPhrases: [], forbiddenClaims: [] };
  }
  return {
    companyDescription:            config.companyDescription,
    coreOffer:                     config.coreOffer,
    targetPersona:                 config.targetPersona,
    mainPainSolved:                config.mainPainSolved,
    mainOutcomePromised:           config.mainOutcomePromised,
    proofPoints:                   config.proofPoints ?? [],
    preferredTone:                 config.preferredTone,
    customToneInstructions:        config.customToneInstructions,
    ctaStyle:                      config.ctaStyle,
    customCta:                     config.customCta,
    forbiddenPhrases:              config.forbiddenPhrases ?? [],
    forbiddenClaims:               config.forbiddenClaims ?? [],
    complianceNotes:               config.complianceNotes,
    personalizationPromptOverride: config.personalizationPromptOverride,
    outreachPromptOverride:        config.outreachPromptOverride,
  };
}

interface Props { id: string }

export function PromptConfigEditor({ id }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['prompt-config', id],
    queryFn: () => promptConfigsApi.get(id),
  });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [form, setForm] = useState<UpsertPromptConfigDto>(() => buildForm(config));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (config) {
      setName(config.name ?? '');
      setDescription(config.description ?? '');
      setForm(buildForm(config));
      setDirty(false);
    }
  }, [config]);

  const patch = (updates: Partial<UpsertPromptConfigDto>) => {
    setForm((f) => ({ ...f, ...updates }));
    setDirty(true);
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      promptConfigsApi.update(id, { ...form, name, description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompt-config', id] });
      queryClient.invalidateQueries({ queryKey: ['prompt-configs'] });
      setDirty(false);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push('/prompt-configs')}
          className="flex items-center gap-1.5 rounded-lg border border-ink/[0.08] px-3 py-1.5 font-mono text-[11px] text-dusk hover:text-mist transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Library
        </button>
        <div>
          <h1 className="font-display text-[18px] font-700 tracking-tight text-ink">{config?.name ?? 'Prompt Profile'}</h1>
          {config && (
            <p className="flex items-center gap-1 font-mono text-[10px] text-dusk">
              <Clock className="h-2.5 w-2.5" />
              Version {config.version}
            </p>
          )}
        </div>
      </div>

      {/* Name & description */}
      <div className="rounded-xl border border-ink/[0.06] bg-surface p-5 space-y-4">
        <div>
          <label className="section-label mb-1.5 block">Profile Name <span className="text-crimson">*</span></label>
          <input
            className={inputCls}
            value={name}
            onChange={(e) => { setName(e.target.value); setDirty(true); }}
            placeholder="e.g. Enterprise SaaS — Consultative"
          />
        </div>
        <div>
          <label className="section-label mb-1.5 block">Description</label>
          <textarea
            className={inputCls}
            rows={2}
            value={description}
            onChange={(e) => { setDescription(e.target.value); setDirty(true); }}
            placeholder="When to use this profile, target persona, tone guidelines…"
          />
        </div>
      </div>

      {/* Config sections */}
      <PositioningSection form={form} onChange={patch} />
      <VoiceCtaSection form={form} onChange={patch} />
      <GuardrailsSection form={form} onChange={patch} />
      <AdvancedOverridesSection form={form} onChange={patch} />

      {/* Save bar */}
      <div className={`flex items-center justify-between rounded-xl border p-4 transition-colors ${
        dirty ? 'border-orchid/20 bg-orchid/[0.03]' : 'border-ink/[0.06] bg-surface'
      }`}>
        <div className="flex items-center gap-2">
          {dirty && <Dot className="h-4 w-4 text-orchid" />}
          <span className="font-mono text-[11px] text-dusk">
            {dirty
              ? 'You have unsaved changes'
              : config
                ? `Saved — version ${config.version}`
                : 'No changes'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={!dirty || saveMutation.isPending}
          className="flex items-center gap-2 rounded-lg bg-orchid/10 px-4 py-2 font-mono text-[12px] font-500 text-orchid ring-1 ring-orchid/20 hover:bg-orchid/15 transition-colors disabled:opacity-40"
        >
          <Save className="h-3.5 w-3.5" />
          {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {/* Preview Sandbox */}
      <PreviewSandbox promptConfigId={id} hasConfig={!!config} currentConfig={form} />

      {/* Version History */}
      {config && (config.history?.length ?? 0) > 0 && (
        <VersionHistory
          promptConfigId={id}
          currentVersion={config.version}
          history={config.history ?? []}
        />
      )}
    </div>
  );
}

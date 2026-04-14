'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Wand2, AlertCircle, CheckCircle, MessageSquare, User } from 'lucide-react';
import { promptConfigs as promptConfigsApi } from '@/lib/api-client';
import { TagInput } from '@/components/ui/tag-input';
import { Field, inputCls } from '../../components/shared';
import { cn } from '@/lib/utils';
import type { PreviewRequest, PreviewResult, UpsertPromptConfigDto } from '@/models';

interface Props {
  /** ID of the prompt config to preview against */
  promptConfigId: string;
  hasConfig: boolean;
  /** Current form state (may be unsaved) — forwarded to backend so preview reflects live edits */
  currentConfig: UpsertPromptConfigDto;
  /** Optional campaign-level overrides applied on top of base config */
  campaignOverrides?: UpsertPromptConfigDto;
}

function defaultRequest(): PreviewRequest {
  return {
    sampleLeadName: '',
    sampleLeadRole: '',
    sampleLeadCompany: '',
    sampleContent: '',
    samplePainPoints: [],
  };
}

const CHANNEL_LABELS: Record<string, string> = {
  'linkedin-dm': 'LinkedIn DM',
  'twitter-dm':  'Twitter/X DM',
  'email':       'Email',
  'reddit-dm':   'Reddit DM',
};

export function PreviewSandbox({ promptConfigId, hasConfig, currentConfig, campaignOverrides }: Props) {
  const [req, setReq] = useState<PreviewRequest>(defaultRequest());
  const [result, setResult] = useState<PreviewResult | null>(null);

  const previewMutation = useMutation({
    mutationFn: (body: PreviewRequest) =>
      promptConfigsApi.preview(promptConfigId, {
        ...body,
        configOverride: currentConfig,
        campaignOverrides,
      }),
    onSuccess: (data) => setResult(data),
  });

  const canGenerate = req.sampleContent.trim().length > 0;

  return (
    <div className="rounded-xl border border-ink/[0.06] bg-surface p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orchid/10">
          <Wand2 className="h-3.5 w-3.5 text-orchid" />
        </div>
        <div>
          <p className="font-display text-[13px] font-600 text-ink">Preview Sandbox</p>
          <p className="font-mono text-[10px] text-dusk">
            Test how your config affects real message generation
          </p>
        </div>
      </div>

      {!hasConfig && (
        <div className="rounded-lg border border-gold/20 bg-gold/[0.04] px-3 py-2">
          <p className="font-mono text-[10px] text-gold">
            Config not saved yet — preview will use your current edits above.
            Fill in positioning and voice fields to see a personalised output.
          </p>
        </div>
      )}

      {/* Input form */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Lead Name">
          <input
            value={req.sampleLeadName ?? ''}
            onChange={(e) => setReq({ ...req, sampleLeadName: e.target.value })}
            className={inputCls}
            placeholder="Jane Doe"
          />
        </Field>

        <Field label="Lead Role">
          <input
            value={req.sampleLeadRole ?? ''}
            onChange={(e) => setReq({ ...req, sampleLeadRole: e.target.value })}
            className={inputCls}
            placeholder="VP of Sales"
          />
        </Field>

        <Field label="Company">
          <input
            value={req.sampleLeadCompany ?? ''}
            onChange={(e) => setReq({ ...req, sampleLeadCompany: e.target.value })}
            className={inputCls}
            placeholder="Acme Corp"
          />
        </Field>

        <div>
          <TagInput
            label="Pain Points"
            tags={req.samplePainPoints ?? []}
            onChange={(tags) => setReq({ ...req, samplePainPoints: tags })}
            placeholder="manual processes, no visibility…"
          />
        </div>

        <div className="md:col-span-2">
          <Field label="Sample Content *" required>
            <textarea
              value={req.sampleContent}
              onChange={(e) => setReq({ ...req, sampleContent: e.target.value })}
              className={`${inputCls} resize-none`}
              rows={3}
              placeholder="Paste a LinkedIn post, profile bio, or any text the lead wrote that shows their intent…"
            />
          </Field>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => previewMutation.mutate(req)}
          disabled={!canGenerate || previewMutation.isPending}
          className="flex items-center gap-2 rounded-lg bg-orchid/10 px-4 py-2 font-mono text-[12px] font-500 text-orchid ring-1 ring-orchid/20 hover:bg-orchid/15 transition-colors disabled:opacity-40"
        >
          <Wand2 className="h-3.5 w-3.5" />
          {previewMutation.isPending ? 'Generating…' : 'Generate Preview'}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="grid grid-cols-1 gap-4 border-t border-ink/[0.06] pt-4 md:grid-cols-2">
          {/* Personalization breakdown */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <User className="h-3.5 w-3.5 text-aqua" />
              <span className="font-mono text-[11px] font-500 text-mist uppercase tracking-wider">
                Personalization
              </span>
            </div>
            {[
              { label: 'Opening Hook',    value: result.personalization.openingHook },
              { label: 'Pain Reference',  value: result.personalization.painPointReference },
              { label: 'Value Prop',      value: result.personalization.valueProposition },
              { label: 'CTA',             value: result.personalization.callToAction },
              { label: 'Tone',            value: result.personalization.toneProfile },
              { label: 'Channel',         value: CHANNEL_LABELS[result.channel] ?? result.channel },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-0.5">
                <span className="font-mono text-[9px] text-dusk uppercase tracking-wider">{label}</span>
                <span className="font-mono text-[11px] text-mist">{value || '—'}</span>
              </div>
            ))}
          </div>

          {/* Generated message */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-orchid" />
                <span className="font-mono text-[11px] font-500 text-mist uppercase tracking-wider">
                  Generated Message
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-elevated px-2 py-0.5 font-mono text-[9px] text-dusk">
                  {CHANNEL_LABELS[result.channel] ?? result.channel}
                </span>
                {result.isApproved ? (
                  <span className="flex items-center gap-1 font-mono text-[9px] text-jade">
                    <CheckCircle className="h-3 w-3" /> Approved
                  </span>
                ) : (
                  <span className="flex items-center gap-1 font-mono text-[9px] text-crimson">
                    <AlertCircle className="h-3 w-3" /> Flagged
                  </span>
                )}
              </div>
            </div>

            <div className={cn(
              'rounded-lg border p-3',
              result.isApproved ? 'border-jade/15 bg-jade/[0.03]' : 'border-crimson/15 bg-crimson/[0.03]',
            )}>
              <p className="font-mono text-[11px] text-ink whitespace-pre-wrap leading-relaxed">
                {result.outreachMessage}
              </p>
            </div>

            {/* Spam score bar */}
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9px] text-dusk">Spam score</span>
              <div className="flex-1 h-1 rounded-full bg-elevated overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    result.spamScore < 0.3 ? 'bg-jade' :
                    result.spamScore < 0.6 ? 'bg-gold' : 'bg-crimson',
                  )}
                  style={{ width: `${result.spamScore * 100}%` }}
                />
              </div>
              <span className={cn(
                'font-mono text-[9px]',
                result.spamScore < 0.3 ? 'text-jade' :
                result.spamScore < 0.6 ? 'text-gold' : 'text-crimson',
              )}>
                {(result.spamScore * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Settings, Cpu, Save } from 'lucide-react';
import { organizations } from '@/lib/api-client';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';

const AI_MODELS = [
  { id: 'claude-opus-4-6',     label: 'Claude Opus 4.6',     provider: 'Anthropic', note: 'Most capable' },
  { id: 'claude-sonnet-4-6',   label: 'Claude Sonnet 4.6',   provider: 'Anthropic', note: 'Balanced' },
  { id: 'gpt-4o',              label: 'GPT-4o',              provider: 'OpenAI',    note: 'Fast & capable' },
  { id: 'gpt-4o-mini',         label: 'GPT-4o Mini',         provider: 'OpenAI',    note: 'Cost-efficient' },
];

export default function SettingsPage() {
  const [personalizationModel, setPersonalizationModel] = useState('claude-opus-4-6');
  const [classificationModel, setClassificationModel] = useState('gpt-4o-mini');
  const [saved, setSaved] = useState(false);

  const orgQuery = useQuery({ queryKey: ['org', 'me'], queryFn: () => organizations.me() });

  const updateMutation = useMutation({
    mutationFn: () =>
      organizations.update({ personalizationModel, classificationModel }),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="font-display text-xl font-700 text-ink">AI Settings</h1>
        <p className="mt-0.5 font-mono text-[11px] text-dusk">
          {orgQuery.data?.name ?? 'Your organization'} · {orgQuery.data?.tier ?? '—'} plan
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Model Selection</CardTitle>
          <Cpu className="h-4 w-4 text-orchid" />
        </CardHeader>

        <div className="space-y-4">
          <ModelPicker
            label="Personalization & Outreach Model"
            description="Used for generating personalized messages. Higher quality = better results."
            value={personalizationModel}
            onChange={setPersonalizationModel}
          />
          <ModelPicker
            label="Classification Model"
            description="Used for intent detection and lead enrichment. Faster/cheaper is usually fine."
            value={classificationModel}
            onChange={setClassificationModel}
          />

          <div className="flex items-center justify-between border-t border-ink/[0.06] pt-4">
            <p className="font-mono text-[10px] text-dusk">
              Changes apply to new leads processed after saving.
            </p>
            <button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              className="flex items-center gap-2 rounded-lg bg-aqua/10 px-4 py-2 font-mono text-[11px] font-500 text-aqua ring-1 ring-aqua/20 hover:bg-aqua/15 disabled:opacity-60 transition-colors"
            >
              <Save className="h-3.5 w-3.5" />
              {saved ? 'Saved!' : updateMutation.isPending ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ModelPicker({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-[13px] font-500 text-ink mb-0.5">{label}</p>
      <p className="font-mono text-[11px] text-dusk mb-2">{description}</p>
      <div className="grid grid-cols-2 gap-2">
        {AI_MODELS.map((model) => (
          <button
            key={model.id}
            onClick={() => onChange(model.id)}
            className={[
              'flex items-start gap-2 rounded-lg border p-3 text-left transition-all',
              value === model.id
                ? 'border-aqua/30 bg-aqua/[0.05]'
                : 'border-ink/[0.06] hover:bg-elevated',
            ].join(' ')}
          >
            <div className={[
              'mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 transition-colors',
              value === model.id ? 'border-aqua bg-aqua/30' : 'border-dusk',
            ].join(' ')} />
            <div>
              <p className="text-[12px] font-500 text-ink">{model.label}</p>
              <p className="font-mono text-[9px] text-dusk">{model.provider} · {model.note}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

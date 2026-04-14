'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  Link2,
  Link2Off,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Save,
  Dot,
  Clock,
  Megaphone,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { promptConfigs as promptConfigsApi, campaigns as campaignsApi } from '@/lib/api-client';
import type { UpsertPromptConfigDto, PromptConfig, Campaign } from '@/models';
import { PositioningSection }       from './positioning-section';
import { VoiceCtaSection }          from './voice-cta-section';
import { GuardrailsSection }        from './guardrails-section';
import { PreviewSandbox }           from './preview-sandbox';
import { VersionHistory }           from './version-history';

// ── helpers ───────────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-lg border border-ink/[0.06] bg-elevated px-3 py-2 font-mono text-[12px] text-ink focus:border-aqua/30 focus:outline-none placeholder:text-dusk';

function emptyOverrides(): UpsertPromptConfigDto {
  return { preferredTone: undefined, ctaStyle: undefined, proofPoints: [], forbiddenPhrases: [], forbiddenClaims: [] };
}

// ── ProfileSelector ───────────────────────────────────────────────────────────

function ProfileSelector({
  selectedId,
  onSelect,
}: {
  selectedId: string | null | undefined;
  onSelect: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  const { data: configs = [] } = useQuery({
    queryKey: ['prompt-configs'],
    queryFn: () => promptConfigsApi.list(),
  });

  const active = configs.filter((c) => c.status === 'active');
  const selected = configs.find((c) => c.id === selectedId);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between rounded-lg border border-ink/[0.06] bg-elevated px-3 py-2.5 text-left transition-colors hover:border-ink/10"
      >
        {selected ? (
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="h-3.5 w-3.5 text-orchid shrink-0" />
            <span className="font-mono text-[12px] text-ink truncate">{selected.name}</span>
            <span className="font-mono text-[10px] text-dusk shrink-0">v{selected.version}</span>
          </div>
        ) : (
          <span className="font-mono text-[12px] text-dusk">Select a prompt profile…</span>
        )}
        <ChevronDown className="h-3.5 w-3.5 text-dusk shrink-0 ml-2" />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl border border-ink/[0.08] bg-surface shadow-2xl">
          {/* Detach option */}
          {selectedId && (
            <button
              type="button"
              onClick={() => { onSelect(null); setOpen(false); }}
              className="flex w-full items-center gap-2 border-b border-ink/[0.06] px-3 py-2.5 text-left hover:bg-ink/[0.03] transition-colors"
            >
              <Link2Off className="h-3.5 w-3.5 text-dusk" />
              <span className="font-mono text-[11px] text-dusk">Detach prompt profile</span>
            </button>
          )}

          {active.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <p className="font-mono text-[11px] text-dusk">No prompt profiles yet</p>
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto py-1">
              {active.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { onSelect(c.id); setOpen(false); }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-ink/[0.03] ${
                    c.id === selectedId ? 'bg-orchid/[0.04]' : ''
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5 text-orchid shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-[12px] text-ink truncate">{c.name}</p>
                    {c.description && (
                      <p className="font-mono text-[10px] text-dusk truncate">{c.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="flex items-center gap-1 font-mono text-[10px] text-dusk">
                      <Clock className="h-2.5 w-2.5" />v{c.version}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-[10px] text-dusk">
                      <Megaphone className="h-2.5 w-2.5" />
                      {(c as typeof c & { _count?: { campaigns: number } })._count?.campaigns ?? 0}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── OverridesPanel ────────────────────────────────────────────────────────────

function OverridesPanel({
  overrides,
  onChange,
}: {
  overrides: UpsertPromptConfigDto;
  onChange: (updates: Partial<UpsertPromptConfigDto>) => void;
}) {
  const [open, setOpen] = useState(false);

  const activeCount = Object.entries(overrides).filter(([, v]) => {
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== null && v !== '';
  }).length;

  return (
    <div className="rounded-xl border border-ink/[0.06] bg-surface">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[11px] font-500 text-mist uppercase tracking-wider">
            Campaign Overrides
          </p>
          <p className="font-mono text-[10px] text-dusk mt-0.5">
            {activeCount > 0
              ? `${activeCount} field${activeCount !== 1 ? 's' : ''} override the base profile`
              : 'No overrides — inheriting all fields from the base profile'}
          </p>
        </div>
        {activeCount > 0 && (
          <span className="rounded-md bg-gold/10 px-2 py-0.5 font-mono text-[10px] text-gold ring-1 ring-gold/20">
            {activeCount} override{activeCount !== 1 ? 's' : ''}
          </span>
        )}
        {open ? (
          <ChevronDown className="h-4 w-4 text-dusk shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-dusk shrink-0" />
        )}
      </button>

      {open && (
        <div className="border-t border-ink/[0.06] p-4 space-y-4">
          <p className="font-mono text-[10px] text-dusk">
            Only fields you set here override the base profile. Leave a field empty to inherit from the profile.
          </p>
          <PositioningSection form={overrides} onChange={onChange} />
          <VoiceCtaSection form={overrides} onChange={onChange} />
          <GuardrailsSection form={overrides} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

// ── PromptConfigTab ───────────────────────────────────────────────────────────

interface Props {
  campaignId: string;
  campaign: Campaign;
}

export function PromptConfigTab({ campaignId, campaign }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const attachedConfig = campaign.promptConfig;
  const [selectedId, setSelectedId] = useState<string | null>(campaign.promptConfigId ?? null);
  const [overrides, setOverrides] = useState<UpsertPromptConfigDto>(
    (campaign.promptOverrides as UpsertPromptConfigDto | null) ?? emptyOverrides(),
  );
  const [dirty, setDirty] = useState(false);

  // Load prompt config details when selected
  const { data: promptConfig } = useQuery({
    queryKey: ['prompt-config', selectedId],
    queryFn: () => promptConfigsApi.get(selectedId!),
    enabled: !!selectedId,
  });

  // Sync when campaign changes externally
  useEffect(() => {
    setSelectedId(campaign.promptConfigId ?? null);
    setOverrides((campaign.promptOverrides as UpsertPromptConfigDto | null) ?? emptyOverrides());
    setDirty(false);
  }, [campaign.promptConfigId, campaign.promptOverrides]);

  const patchOverrides = (updates: Partial<UpsertPromptConfigDto>) => {
    setOverrides((o) => ({ ...o, ...updates }));
    setDirty(true);
  };

  const handleSelectProfile = (id: string | null) => {
    setSelectedId(id);
    setDirty(true);
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      campaignsApi.update(campaignId, {
        promptConfigId: selectedId,
        promptOverrides: overrides,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setDirty(false);
    },
  });

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Profile selector card */}
      <div className="rounded-xl border border-ink/[0.06] bg-surface p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orchid/10">
              <Sparkles className="h-3.5 w-3.5 text-orchid" />
            </div>
            <div>
              <p className="font-mono text-[12px] font-500 text-ink">Prompt Profile</p>
              <p className="font-mono text-[10px] text-dusk">Select a reusable profile from the library</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push('/prompt-configs')}
            className="flex items-center gap-1.5 rounded-lg border border-ink/[0.08] px-3 py-1.5 font-mono text-[11px] text-dusk hover:text-mist transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            Open Library
          </button>
        </div>

        <ProfileSelector selectedId={selectedId} onSelect={handleSelectProfile} />

        {/* Selected profile summary */}
        {attachedConfig && selectedId === attachedConfig.id && (
          <div className="flex items-center gap-3 rounded-lg border border-orchid/15 bg-orchid/[0.04] px-3 py-2.5">
            <Link2 className="h-3.5 w-3.5 text-orchid shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-mono text-[11px] text-orchid truncate">{attachedConfig.name}</p>
              <p className="font-mono text-[10px] text-dusk">v{attachedConfig.version} · linked</p>
            </div>
            <button
              type="button"
              onClick={() => router.push(`/prompt-configs/${attachedConfig.id}`)}
              className="font-mono text-[10px] text-orchid hover:underline shrink-0"
            >
              Edit profile →
            </button>
          </div>
        )}
      </div>

      {/* Campaign overrides (only when a profile is selected) */}
      {selectedId && (
        <OverridesPanel overrides={overrides} onChange={patchOverrides} />
      )}

      {/* Save bar */}
      <div className={`flex items-center justify-between rounded-xl border p-4 transition-colors ${
        dirty ? 'border-aqua/20 bg-aqua/[0.03]' : 'border-ink/[0.06] bg-surface'
      }`}>
        <div className="flex items-center gap-2">
          {dirty && <Dot className="h-4 w-4 text-aqua" />}
          <span className="font-mono text-[11px] text-dusk">
            {dirty
              ? 'You have unsaved changes'
              : selectedId
                ? 'Profile attached'
                : 'No profile attached'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={!dirty || saveMutation.isPending}
          className="flex items-center gap-2 rounded-lg bg-aqua/10 px-4 py-2 font-mono text-[12px] font-500 text-aqua ring-1 ring-aqua/20 hover:bg-aqua/15 transition-colors disabled:opacity-40"
        >
          <Save className="h-3.5 w-3.5" />
          {saveMutation.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* Preview Sandbox (only when a profile is linked) */}
      {selectedId && (
        <PreviewSandbox
          promptConfigId={selectedId}
          hasConfig={!!promptConfig}
          currentConfig={overrides}
          campaignOverrides={overrides}
        />
      )}

      {/* Version History (from the linked profile) */}
      {promptConfig && (promptConfig.history?.length ?? 0) > 0 && (
        <VersionHistory
          promptConfigId={selectedId!}
          currentVersion={promptConfig.version}
          history={promptConfig.history ?? []}
        />
      )}
    </div>
  );
}

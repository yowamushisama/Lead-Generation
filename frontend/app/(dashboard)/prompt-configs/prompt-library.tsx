'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Plus,
  Copy,
  Archive,
  Pencil,
  Clock,
  Megaphone,
  ChevronRight,
  X,
} from 'lucide-react';
import { promptConfigs as promptConfigsApi } from '@/lib/api-client';
import type { CreatePromptConfigDto, PromptConfig } from '@/models';

// ── helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const inputCls =
  'w-full rounded-lg border border-ink/[0.06] bg-elevated px-3 py-2 font-mono text-[12px] text-ink focus:border-aqua/30 focus:outline-none placeholder:text-dusk';

// ── CreateModal ───────────────────────────────────────────────────────────────

function CreateModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const createMutation = useMutation({
    mutationFn: (dto: CreatePromptConfigDto) => promptConfigsApi.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompt-configs'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-base/80 backdrop-blur-sm">
      <div className="w-[480px] rounded-2xl border border-ink/[0.08] bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink/[0.06] px-5 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-orchid" />
            <span className="font-mono text-[13px] font-600 text-ink">New Prompt Profile</span>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-dusk hover:text-mist transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div>
            <label className="section-label mb-1.5 block">
              Name <span className="text-crimson">*</span>
            </label>
            <input
              className={inputCls}
              placeholder="e.g. Enterprise SaaS — Consultative"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="section-label mb-1.5 block">Description</label>
            <textarea
              className={inputCls}
              rows={3}
              placeholder="When to use this profile, target persona, tone guidelines…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <p className="font-mono text-[11px] text-mist">
            After creating, you can fill in positioning, voice, guardrails, and advanced overrides from the profile editor.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-ink/[0.06] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-ink/[0.08] px-4 py-2 font-mono text-[12px] text-dusk hover:text-mist transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => createMutation.mutate({ name, description })}
            disabled={!name.trim() || createMutation.isPending}
            className="flex items-center gap-2 rounded-lg bg-orchid/10 px-4 py-2 font-mono text-[12px] font-500 text-orchid ring-1 ring-orchid/20 hover:bg-orchid/15 transition-colors disabled:opacity-40"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {createMutation.isPending ? 'Creating…' : 'Create Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PromptConfigCard ──────────────────────────────────────────────────────────

function PromptConfigCard({
  config,
  campaignCount,
  onClone,
  onArchive,
}: {
  config: PromptConfig;
  campaignCount: number;
  onClone: () => void;
  onArchive: () => void;
}) {
  const router = useRouter();
  const isArchived = config.status === 'archived';

  return (
    <div className={`group relative rounded-2xl border bg-surface transition-all duration-150 ${
      isArchived ? 'border-ink/[0.04] opacity-60' : 'border-ink/[0.06] hover:border-aqua/20 hover:shadow-glow-aqua'
    }`}>
      {/* Status dot */}
      {!isArchived && (
        <span className="absolute right-4 top-4 h-1.5 w-1.5 rounded-full bg-jade" title="Active" />
      )}

      <div className="p-5">
        {/* Header */}
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orchid/10 ring-1 ring-orchid/20">
            <Sparkles className="h-3.5 w-3.5 text-orchid" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-mono text-[13px] font-600 text-ink">{config.name}</h3>
            {config.description && (
              <p className="mt-0.5 line-clamp-2 font-mono text-[10px] text-dusk">{config.description}</p>
            )}
          </div>
        </div>

        {/* Meta chips */}
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 rounded-md border border-ink/[0.06] bg-elevated px-2 py-0.5 font-mono text-[10px] text-dusk">
            <Clock className="h-2.5 w-2.5" />
            v{config.version}
          </span>
          <span className="flex items-center gap-1 rounded-md border border-ink/[0.06] bg-elevated px-2 py-0.5 font-mono text-[10px] text-dusk">
            <Megaphone className="h-2.5 w-2.5" />
            {campaignCount} campaign{campaignCount !== 1 ? 's' : ''}
          </span>
          <span className="rounded-md border border-ink/[0.06] bg-elevated px-2 py-0.5 font-mono text-[10px] text-dusk">
            {relativeTime(config.updatedAt)}
          </span>
          {config.preferredTone && (
            <span className="rounded-md border border-aqua/20 bg-aqua/[0.06] px-2 py-0.5 font-mono text-[10px] text-aqua capitalize">
              {config.preferredTone}
            </span>
          )}
        </div>

        {/* Guardrail badges */}
        {((config.forbiddenPhrases?.length ?? 0) > 0 || config.complianceNotes) && (
          <div className="mb-4 flex items-center gap-1.5">
            <span className="rounded-md border border-crimson/20 bg-crimson/[0.06] px-2 py-0.5 font-mono text-[10px] text-crimson">
              {(config.forbiddenPhrases?.length ?? 0)} guardrails
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onClone}
              title="Clone"
              className="rounded-lg p-1.5 text-dusk hover:bg-ink/[0.04] hover:text-mist transition-colors"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            {!isArchived && (
              <button
                type="button"
                onClick={onArchive}
                title="Archive"
                className="rounded-lg p-1.5 text-dusk hover:bg-ink/[0.04] hover:text-mist transition-colors"
              >
                <Archive className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => router.push(`/prompt-configs/${config.id}`)}
            className="flex items-center gap-1.5 rounded-lg border border-ink/[0.08] px-3 py-1.5 font-mono text-[11px] text-mist hover:border-aqua/20 hover:text-aqua transition-colors"
          >
            <Pencil className="h-3 w-3" />
            Edit
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PromptLibrary ─────────────────────────────────────────────────────────────

type StatusFilter = 'active' | 'archived' | 'all';

export function PromptLibrary() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>('active');

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['prompt-configs'],
    queryFn: () => promptConfigsApi.list(),
  });

  const cloneMutation = useMutation({
    mutationFn: (id: string) => promptConfigsApi.clone(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['prompt-configs'] }),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => promptConfigsApi.archive(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['prompt-configs'] }),
  });

  const filtered = configs.filter((c) =>
    filter === 'all' ? true : c.status === filter,
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[22px] font-700 tracking-tight text-ink">Prompt Library</h1>
          <p className="mt-0.5 font-mono text-[11px] text-dusk">
            Reusable prompt profiles — attach one to any campaign, apply campaign-level overrides.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-xl bg-orchid/10 px-4 py-2.5 font-mono text-[12px] font-500 text-orchid ring-1 ring-orchid/20 hover:bg-orchid/15 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New Profile
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 rounded-xl border border-ink/[0.06] bg-surface p-1 w-fit">
        {(['active', 'archived', 'all'] as StatusFilter[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-lg px-3 py-1.5 font-mono text-[11px] transition-colors capitalize ${
              filter === s
                ? 'bg-aqua/10 text-aqua ring-1 ring-aqua/20'
                : 'text-dusk hover:text-mist'
            }`}
          >
            {s} {s !== 'all' && `(${configs.filter((c) => c.status === s).length})`}
          </button>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-44 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orchid/10 ring-1 ring-orchid/20">
            <Sparkles className="h-5 w-5 text-orchid" />
          </div>
          <p className="font-mono text-[12px] text-mist">
            {filter === 'archived' ? 'No archived profiles' : 'No prompt profiles yet'}
          </p>
          {filter === 'active' && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="font-mono text-[11px] text-orchid hover:underline"
            >
              Create your first prompt profile →
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((config) => (
            <PromptConfigCard
              key={config.id}
              config={config}
              campaignCount={(config as typeof config & { _count?: { campaigns: number } })._count?.campaigns ?? 0}
              onClone={() => cloneMutation.mutate(config.id)}
              onArchive={() => archiveMutation.mutate(config.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

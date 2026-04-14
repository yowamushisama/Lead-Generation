'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pause, Play, BarChart2, Users, MessageSquare,
  TrendingUp, Calendar, X, Megaphone, Archive,
  Target, Layers, Settings2, ChevronRight,
} from 'lucide-react';
import { campaigns as campaignsApi, icp as icpApi } from '@/lib/api-client';
import type { Campaign, CreateCampaignDto, CampaignStatus } from '@/models';
import { Card } from '@/components/ui/card';
import { cn, formatPercent, relativeTime } from '@/lib/utils';
import {
  CAMPAIGN_LEAD_SOURCES,
  CAMPAIGN_OUTREACH_CHANNELS,
  CAMPAIGN_OBJECTIVES,
  CAMPAIGN_STATUS_TABS,
  CAMPAIGN_STATUS_CONFIG,
  OBJECTIVE_LABELS,
} from '@/constants';
import {
  inputCls,
  FormSection,
  Field,
  RadioPill,
  ToggleChip,
  ToneSelector,
  ApprovalModeSelector,
} from './components/shared';

// ── Default form state ─────────────────────────────────────────────────────────

function defaultForm(): Omit<CreateCampaignDto, 'icpProfileId'> & { icpProfileId: string } {
  return {
    name: '',
    description: '',
    serviceType: '',
    icpProfileId: '',
    objective: 'demo_requests',
    linkedChannels: ['email'],
    outreachTone: 'professional',
    approvalMode: 'manual',
    maxLeadsPerDay: 50,
    maxOutreachPerDay: 20,
    targetSources: [],
    startAsDraft: false,
  };
}

// ── CampaignsHub ──────────────────────────────────────────────────────────────

export function CampaignsHub() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [form, setForm] = useState<CreateCampaignDto>(defaultForm());

  const { data: campaignList = [], isLoading } = useQuery({
    queryKey: ['campaigns', statusFilter],
    queryFn: () => campaignsApi.list(statusFilter ? { status: statusFilter } : undefined),
  });

  const { data: icpProfiles = [] } = useQuery({
    queryKey: ['icp'],
    queryFn: () => icpApi.list(),
    enabled: showCreate,
  });

  const launchMutation = useMutation({
    mutationFn: (id: string) => campaignsApi.launch(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  });
  const pauseMutation = useMutation({
    mutationFn: (id: string) => campaignsApi.pause(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  });
  const resumeMutation = useMutation({
    mutationFn: (id: string) => campaignsApi.resume(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  });
  const archiveMutation = useMutation({
    mutationFn: (id: string) => campaignsApi.archive(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  });
  const createMutation = useMutation({
    mutationFn: (dto: CreateCampaignDto) => campaignsApi.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setShowCreate(false);
      setForm(defaultForm());
    },
  });

  const closeCreate = () => { setShowCreate(false); setForm(defaultForm()); };

  const toggleSource = (src: string) =>
    setForm((f) => ({
      ...f,
      targetSources: f.targetSources?.includes(src)
        ? f.targetSources.filter((s) => s !== src)
        : [...(f.targetSources ?? []), src],
    }));

  const toggleChannel = (ch: string) =>
    setForm((f) => ({
      ...f,
      linkedChannels: f.linkedChannels?.includes(ch)
        ? f.linkedChannels.filter((c) => c !== ch)
        : [...(f.linkedChannels ?? []), ch],
    }));

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-700 text-ink">Campaigns</h1>
          <p className="mt-0.5 font-mono text-[11px] text-dusk">{campaignList.length} campaigns</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-aqua/10 px-4 py-2 font-mono text-[12px] font-500 text-aqua ring-1 ring-aqua/20 hover:bg-aqua/15 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Campaign
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 border-b border-ink/[0.06] pb-0.5">
        {CAMPAIGN_STATUS_TABS.map((tab) => (
          <button
            key={tab.label}
            onClick={() => setStatusFilter(tab.value)}
            className={cn(
              'px-3 py-1.5 font-mono text-[11px] rounded-t-md transition-colors',
              statusFilter === tab.value
                ? 'text-aqua border-b-2 border-aqua -mb-px bg-aqua/5'
                : 'text-dusk hover:text-mist',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-base/80 backdrop-blur-sm p-4 pt-10"
          onClick={closeCreate}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-ink/[0.08] bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-ink/[0.06]">
              <div className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-aqua" />
                <h2 className="font-display text-[15px] font-600 text-ink">New Campaign</h2>
              </div>
              <button
                onClick={closeCreate}
                className="flex items-center justify-center h-7 w-7 rounded-lg border border-ink/[0.08] bg-elevated text-dusk hover:border-ink/20 hover:text-mist transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Scrollable form body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

              <FormSection icon={<Target className="h-3.5 w-3.5 text-aqua" />} title="Basics">
                <div className="space-y-3">
                  <Field label="Campaign Name" required>
                    <input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className={inputCls}
                      placeholder="Q3 SaaS Outreach"
                    />
                  </Field>
                  <Field label="Offer / Service Category">
                    <input
                      value={form.serviceType ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, serviceType: e.target.value }))}
                      className={inputCls}
                      placeholder="B2B SaaS consulting, product demo…"
                    />
                  </Field>
                  <Field label="Description">
                    <textarea
                      value={form.description ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      rows={2}
                      className={`${inputCls} resize-none`}
                      placeholder="Target SaaS founders with 10–100 employees…"
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection icon={<Layers className="h-3.5 w-3.5 text-orchid" />} title="Targeting">
                <div className="space-y-3">
                  <Field label="ICP Profile" required>
                    {icpProfiles.length === 0 ? (
                      <div className="rounded-md border border-dusk/20 bg-elevated px-3 py-2 font-mono text-[11px] text-dusk">
                        No ICP profiles found.{' '}
                        <a href="/icp" className="text-aqua underline underline-offset-2">
                          Create one first
                        </a>{' '}
                        before launching a campaign.
                      </div>
                    ) : (
                      <>
                        <select
                          value={form.icpProfileId}
                          onChange={(e) => setForm((f) => ({ ...f, icpProfileId: e.target.value }))}
                          className={inputCls}
                        >
                          <option value="">Select an ICP profile…</option>
                          {icpProfiles.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        {!form.icpProfileId && (
                          <p className="mt-1 font-mono text-[10px] text-dusk/70">
                            Targeting (industries, locations, keywords) is derived from the ICP profile
                          </p>
                        )}
                      </>
                    )}
                  </Field>
                  <Field label="Lead Sources">
                    <div className="flex flex-wrap gap-2">
                      {CAMPAIGN_LEAD_SOURCES.map(({ id, label, Icon }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => toggleSource(id)}
                          className={cn(
                            'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition-colors',
                            form.targetSources?.includes(id)
                              ? 'border-aqua/30 bg-aqua/10 text-aqua'
                              : 'border-ink/[0.06] bg-elevated text-dusk hover:text-mist',
                          )}
                        >
                          <Icon className="h-3 w-3" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>
              </FormSection>

              <FormSection icon={<MessageSquare className="h-3.5 w-3.5 text-gold" />} title="Outreach">
                <div className="space-y-3">
                  <Field label="Campaign Objective">
                    <div className="flex flex-wrap gap-2">
                      {CAMPAIGN_OBJECTIVES.map(({ id, label }) => (
                        <RadioPill
                          key={id}
                          selected={form.objective === id}
                          onClick={() => setForm((f) => ({ ...f, objective: id }))}
                        >
                          {label}
                        </RadioPill>
                      ))}
                    </div>
                  </Field>
                  <Field label="Linked Channels">
                    <div className="flex flex-wrap gap-2">
                      {CAMPAIGN_OUTREACH_CHANNELS.map(({ id, label }) => (
                        <ToggleChip
                          key={id}
                          selected={!!form.linkedChannels?.includes(id)}
                          onClick={() => toggleChannel(id)}
                          color="orchid"
                        >
                          {label}
                        </ToggleChip>
                      ))}
                    </div>
                  </Field>
                  <Field label="Outreach Tone">
                    <ToneSelector
                      value={form.outreachTone}
                      onChange={(tone) => setForm((f) => ({ ...f, outreachTone: tone }))}
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection icon={<Settings2 className="h-3.5 w-3.5 text-jade" />} title="Controls">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Daily Lead Cap">
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={form.maxLeadsPerDay ?? 50}
                        onChange={(e) => setForm((f) => ({ ...f, maxLeadsPerDay: Number(e.target.value) }))}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Daily Outreach Cap">
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={form.maxOutreachPerDay ?? 20}
                        onChange={(e) => setForm((f) => ({ ...f, maxOutreachPerDay: Number(e.target.value) }))}
                        className={inputCls}
                      />
                    </Field>
                  </div>
                  <Field label="Approval Mode">
                    <ApprovalModeSelector
                      value={form.approvalMode}
                      onChange={(mode) => setForm((f) => ({ ...f, approvalMode: mode }))}
                    />
                  </Field>
                </div>
              </FormSection>

            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-ink/[0.06]">
              <button
                onClick={closeCreate}
                className="rounded-lg border border-ink/[0.06] px-4 py-2 font-mono text-[11px] text-dusk hover:text-mist"
              >
                Cancel
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => createMutation.mutate({ ...form, startAsDraft: true })}
                  disabled={!form.name.trim() || !form.icpProfileId || createMutation.isPending}
                  className="rounded-lg border border-ink/10 px-4 py-2 font-mono text-[11px] text-mist hover:text-ink disabled:opacity-50 transition-colors"
                >
                  Save as Draft
                </button>
                <button
                  onClick={() => createMutation.mutate({ ...form, startAsDraft: false })}
                  disabled={!form.name.trim() || !form.icpProfileId || createMutation.isPending}
                  className="rounded-lg bg-aqua/10 px-4 py-2 font-mono text-[11px] font-500 text-aqua ring-1 ring-aqua/20 disabled:opacity-50 hover:bg-aqua/15 transition-colors"
                >
                  {createMutation.isPending ? 'Launching…' : 'Launch Campaign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Campaign grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-52 rounded-xl" />)}
        </div>
      ) : campaignList.length === 0 ? (
        <EmptyList />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {campaignList.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onLaunch={() => launchMutation.mutate(campaign.id)}
              onPause={() => pauseMutation.mutate(campaign.id)}
              onResume={() => resumeMutation.mutate(campaign.id)}
              onArchive={() => archiveMutation.mutate(campaign.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── EmptyList ─────────────────────────────────────────────────────────────────

function EmptyList() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <Megaphone className="h-10 w-10 text-dusk" />
      <p className="text-[14px] font-500 text-mist">No campaigns yet</p>
      <p className="font-mono text-[11px] text-dusk">Create your first campaign to start acquiring leads</p>
    </div>
  );
}

// ── CampaignCard ──────────────────────────────────────────────────────────────

function CampaignCard({
  campaign,
  onLaunch,
  onPause,
  onResume,
  onArchive,
}: {
  campaign: Campaign;
  onLaunch: () => void;
  onPause: () => void;
  onResume: () => void;
  onArchive: () => void;
}) {
  const isActive   = campaign.status === 'ACTIVE';
  const isDraft    = campaign.status === 'DRAFT';
  const isArchived = campaign.status === 'ARCHIVED';
  const isPaused   = campaign.status === 'PAUSED';

  const replyRate = campaign.messagesSent > 0 ? campaign.replies / campaign.messagesSent : 0;
  const convRate  = campaign.leadsGenerated > 0 ? campaign.conversions / campaign.leadsGenerated : 0;

  const settings = campaign.settings as {
    objective?: string;
    targetSources?: string[];
  } | undefined;

  const sources   = settings?.targetSources ?? [];
  const objective = settings?.objective as keyof typeof OBJECTIVE_LABELS | undefined;
  const sc = CAMPAIGN_STATUS_CONFIG[campaign.status as CampaignStatus] ?? CAMPAIGN_STATUS_CONFIG.DRAFT;

  return (
    <Link
      href={`/campaigns/${campaign.id}`}
      className={cn(
        'block rounded-xl border bg-surface p-4 transition-all hover:bg-elevated hover:shadow-sm group',
        isActive ? 'border-jade/15' : 'border-ink/[0.06]',
        isArchived && 'opacity-60',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[14px] font-600 text-ink truncate group-hover:text-aqua transition-colors">
            {campaign.name}
          </h3>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {objective && (
              <span className="font-mono text-[9px] text-dusk bg-elevated px-1.5 py-0.5 rounded-md">
                {OBJECTIVE_LABELS[objective] ?? objective}
              </span>
            )}
            {sources.slice(0, 3).map((src) => {
              const source = CAMPAIGN_LEAD_SOURCES.find((s) => s.id === src);
              return source ? <source.Icon key={src} className="h-3 w-3 text-dusk" /> : null;
            })}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn(
            'flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9px]',
            sc.bg, sc.text,
          )}>
            <span className={cn('h-1.5 w-1.5 rounded-full', sc.dot)} />
            {campaign.status}
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-dusk group-hover:text-aqua transition-colors" />
        </div>
      </div>

      {/* Stats / placeholder */}
      {!isDraft && !isArchived ? (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {[
            { icon: Users,         label: 'Leads',   value: campaign.leadsGenerated,  color: 'text-aqua' },
            { icon: MessageSquare, label: 'Sent',    value: campaign.messagesSent,     color: 'text-orchid' },
            { icon: TrendingUp,    label: 'Reply',   value: formatPercent(replyRate),  color: 'text-jade' },
            { icon: BarChart2,     label: 'Convert', value: formatPercent(convRate),   color: 'text-gold' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="rounded-lg bg-elevated p-2">
              <div className="flex items-center gap-1 mb-0.5">
                <Icon className={cn('h-3 w-3', color)} />
                <span className="font-mono text-[9px] text-dusk">{label}</span>
              </div>
              <span className={cn('num font-mono text-[13px] font-600', color)}>{value}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mb-3 rounded-lg bg-elevated px-3 py-2 font-mono text-[10px] text-dusk">
          {isDraft ? 'Draft — not yet launched' : 'Archived'}
        </div>
      )}

      {/* Footer */}
      <div
        className="flex items-center justify-between border-t border-ink/[0.06] pt-3"
        onClick={(e) => e.preventDefault()}
      >
        <div className="flex items-center gap-1 font-mono text-[10px] text-dusk">
          <Calendar className="h-3 w-3" />
          {relativeTime(campaign.createdAt)}
        </div>
        <div className="flex items-center gap-1.5">
          {isActive && (
            <CardButton onClick={onPause} color="gold" icon={Pause} label="Pause" />
          )}
          {isDraft && (
            <CardButton onClick={onLaunch} color="jade" icon={Play} label="Launch" />
          )}
          {isPaused && (
            <CardButton onClick={onResume} color="jade" icon={Play} label="Resume" />
          )}
          {(isPaused || isDraft) && (
            <CardButton onClick={onArchive} color="dusk" icon={Archive} />
          )}
        </div>
      </div>
    </Link>
  );
}

function CardButton({
  onClick,
  color,
  icon: Icon,
  label,
}: {
  onClick: (e: React.MouseEvent) => void;
  color: 'gold' | 'jade' | 'dusk';
  icon: React.FC<{ className?: string }>;
  label?: string;
}) {
  const colorCls = {
    gold: 'border-gold/20 text-gold hover:bg-gold/5',
    jade: 'border-jade/20 text-jade hover:bg-jade/5',
    dusk: 'border-ink/[0.06] text-dusk hover:text-mist',
  }[color];

  return (
    <button
      onClick={(e) => { e.preventDefault(); onClick(e); }}
      className={cn(
        'flex items-center gap-1 rounded-lg border px-2 py-1 font-mono text-[10px] transition-colors',
        colorCls,
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

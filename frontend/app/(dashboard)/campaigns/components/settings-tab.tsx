'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Target, Layers, MessageSquare, Settings2 } from 'lucide-react';
import { campaigns as campaignsApi, icp as icpApi } from '@/lib/api-client';
import type { Campaign, UpdateCampaignDto, CampaignObjective, OutreachTone, ApprovalMode } from '@/models';
import { cn } from '@/lib/utils';
import {
  CAMPAIGN_LEAD_SOURCES,
  CAMPAIGN_OUTREACH_CHANNELS,
  CAMPAIGN_OBJECTIVES,
} from '@/constants';
import {
  inputCls,
  FormSection,
  Field,
  RadioPill,
  ToggleChip,
  ToneSelector,
  ApprovalModeSelector,
} from './shared';

export function SettingsTab({ campaign, onSaved }: { campaign: Campaign; onSaved: () => void }) {
  const isArchived = campaign.status === 'ARCHIVED';

  const settings = campaign.settings as {
    objective?: CampaignObjective;
    outreachTone?: OutreachTone;
    approvalMode?: ApprovalMode;
    serviceType?: string;
    linkedChannels?: string[];
    targetSources?: string[];
    maxLeadsPerDay?: number;
    maxOutreachPerDay?: number;
  } | undefined;

  const [form, setForm] = useState<UpdateCampaignDto>({
    name:             campaign.name,
    description:      campaign.description,
    serviceType:      settings?.serviceType ?? '',
    icpProfileId:     campaign.icpProfileId,
    objective:        settings?.objective,
    linkedChannels:   settings?.linkedChannels ?? [],
    outreachTone:     settings?.outreachTone ?? 'professional',
    approvalMode:     settings?.approvalMode ?? 'manual',
    maxLeadsPerDay:   settings?.maxLeadsPerDay ?? 50,
    maxOutreachPerDay: settings?.maxOutreachPerDay ?? 20,
    targetSources:    settings?.targetSources ?? [],
  });

  const { data: icpProfiles = [] } = useQuery({
    queryKey: ['icp'],
    queryFn: () => icpApi.list(),
  });

  const saveMutation = useMutation({
    mutationFn: () => campaignsApi.update(campaign.id, form),
    onSuccess: () => onSaved(),
  });

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

  const selectedIcp = icpProfiles.find((p) => p.id === (form.icpProfileId ?? campaign.icpProfileId));

  return (
    <div className="max-w-2xl space-y-6">

      {/* Archive notice */}
      {isArchived && (
        <div className="rounded-md border border-dusk/20 bg-elevated px-4 py-3 font-mono text-[11px] text-dusk">
          This campaign is archived and cannot be edited. Archive is permanent.
        </div>
      )}

      <fieldset disabled={isArchived} className="contents">

      {/* Basics */}
      <FormSection icon={<Target className="h-3.5 w-3.5 text-aqua" />} title="Basics">
        <div className="space-y-3">
          <Field label="Campaign Name" required>
            <input
              value={form.name ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputCls}
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
            />
          </Field>
        </div>
      </FormSection>

      {/* Targeting */}
      <FormSection icon={<Layers className="h-3.5 w-3.5 text-orchid" />} title="Targeting">
        <div className="space-y-3">
          <Field label="ICP Profile" required>
            <select
              value={form.icpProfileId ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, icpProfileId: e.target.value || undefined }))}
              className={inputCls}
            >
              <option value="">Select an ICP profile…</option>
              {icpProfiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {selectedIcp && (
              <div className="mt-1.5 rounded-md bg-elevated px-3 py-2 font-mono text-[10px] text-dusk space-y-0.5">
                {selectedIcp.config?.targetIndustries?.length ? (
                  <p><span className="text-mist">Industries:</span> {selectedIcp.config.targetIndustries.join(', ')}</p>
                ) : null}
                {selectedIcp.config?.targetLocations?.length ? (
                  <p><span className="text-mist">Locations:</span> {selectedIcp.config.targetLocations.join(', ')}</p>
                ) : null}
                {selectedIcp.config?.buyerSignals?.length ? (
                  <p><span className="text-mist">Keywords:</span> {selectedIcp.config.buyerSignals.slice(0, 5).join(', ')}{selectedIcp.config.buyerSignals.length > 5 ? '…' : ''}</p>
                ) : null}
              </div>
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

      {/* Outreach */}
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

      {/* Controls */}
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

      {/* Save bar */}
      <div className="flex items-center justify-between border-t border-ink/[0.06] pt-4">
        <span className="font-mono text-[11px] text-dusk">
          {isArchived
            ? 'Archived campaigns cannot be modified'
            : 'Campaign status is controlled via the action buttons above'}
        </span>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !form.name?.trim() || isArchived}
          className="rounded-lg bg-aqua/10 px-5 py-2 font-mono text-[12px] font-500 text-aqua ring-1 ring-aqua/20 hover:bg-aqua/15 disabled:opacity-50 transition-colors"
        >
          {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      </fieldset>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Target, Check, X, ChevronDown, ChevronRight, Edit } from 'lucide-react';
import { icp as icpApi } from '@/lib/api-client';
import type { ICPProfile, ICPConfig } from '@/models';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const SCORING_FACTORS = [
  { key: 'intent',   label: 'Intent Strength',  color: '#06B6D4', max: 30 },
  { key: 'urgency',  label: 'Urgency Signals',   color: '#EF4444', max: 15 },
  { key: 'role',     label: 'Role Fit',          color: '#7C3AED', max: 20 },
  { key: 'recency',  label: 'Recency',           color: '#F59E0B', max: 15 },
  { key: 'budget',   label: 'Budget Indicators', color: '#10B981', max: 15 },
  { key: 'icp',      label: 'ICP Fit',           color: '#F97316', max: 20 },
  { key: 'negative', label: 'Negative Signals',  color: '#94A3B8', max: -30 },
];

const COMPANY_STAGES = ['pre-seed', 'seed', 'series-a', 'series-b', 'growth', 'enterprise'];

export function ICPBuilder() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newConfig, setNewConfig] = useState<ICPConfig>({
    targetRoles: [],
    targetIndustries: [],
    targetStages: [],
    targetLocations: [],
    buyerSignals: [],
    urgencySignals: [],
    budgetSignals: [],
  });
  const [weights, setWeights] = useState<Record<string, number>>(
    Object.fromEntries(SCORING_FACTORS.map((f) => [f.key, Math.abs(f.max)])),
  );

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['icp'],
    queryFn: () => icpApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: () => icpApi.create({ name: newName, config: newConfig }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['icp'] });
      setShowCreate(false);
      setNewName('');
    },
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-700 text-ink">ICP Builder</h1>
          <p className="mt-0.5 font-mono text-[11px] text-dusk">Configure Ideal Customer Profiles</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 rounded-lg bg-aqua/10 px-4 py-2 font-mono text-[12px] font-500 text-aqua ring-1 ring-aqua/20 hover:bg-aqua/15 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New ICP
        </button>
      </div>

      {/* Create panel */}
      {showCreate && (
        <Card className="border-aqua/15">
          <h2 className="font-display text-[14px] font-600 text-ink mb-4">New ICP Profile</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <TagInput label="Profile Name" value={newName} onChange={(v) => setNewName(v)} placeholder="Enterprise SaaS CTOs" single />
              <TagInput label="Target Roles" tags={newConfig.targetRoles ?? []}
                onChange={(t: string[]) => setNewConfig({ ...newConfig, targetRoles: t })}
                placeholder="CTO, VP Engineering, Head of Product" />
              <TagInput label="Target Industries" tags={newConfig.targetIndustries ?? []}
                onChange={(t: string[]) => setNewConfig({ ...newConfig, targetIndustries: t })}
                placeholder="SaaS, Fintech, Healthcare" />
              <TagInput label="Target Locations" tags={newConfig.targetLocations ?? []}
                onChange={(t: string[]) => setNewConfig({ ...newConfig, targetLocations: t })}
                placeholder="US, UK, Canada" />
            </div>
            <div className="space-y-3">
              <div>
                <label className="section-label mb-1.5 block">Company Stages</label>
                <div className="flex flex-wrap gap-1.5">
                  {COMPANY_STAGES.map((stage) => {
                    const active = newConfig.targetStages?.includes(stage);
                    return (
                      <button
                        key={stage}
                        onClick={() => {
                          const current = newConfig.targetStages ?? [];
                          setNewConfig({
                            ...newConfig,
                            targetStages: active
                              ? current.filter((s) => s !== stage)
                              : [...current, stage],
                          });
                        }}
                        className={cn(
                          'rounded-md px-2.5 py-1 font-mono text-[10px] transition-colors border',
                          active
                            ? 'border-aqua/30 bg-aqua/10 text-aqua'
                            : 'border-ink/[0.06] text-dusk hover:text-mist',
                        )}
                      >
                        {stage}
                      </button>
                    );
                  })}
                </div>
              </div>
              <TagInput label="Buyer Signals" tags={newConfig.buyerSignals ?? []}
                onChange={(t: string[]) => setNewConfig({ ...newConfig, buyerSignals: t })}
                placeholder="looking for, evaluating, need help with" />
              <TagInput label="Urgency Signals" tags={newConfig.urgencySignals ?? []}
                onChange={(t: string[]) => setNewConfig({ ...newConfig, urgencySignals: t })}
                placeholder="urgent, ASAP, this quarter" />
              <TagInput label="Budget Signals" tags={newConfig.budgetSignals ?? []}
                onChange={(t: string[]) => setNewConfig({ ...newConfig, budgetSignals: t })}
                placeholder="budget approved, looking to spend, ROI" />
            </div>
          </div>

          {/* Scoring weights */}
          <div className="mt-4 border-t border-ink/[0.06] pt-4">
            <h3 className="font-display text-[12px] font-600 text-ink mb-3">Scoring Weights</h3>
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              {SCORING_FACTORS.map((factor) => (
                <div key={factor.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[10px] text-mist">{factor.label}</span>
                    <span className="num font-mono text-[10px]" style={{ color: factor.color }}>
                      {weights[factor.key]}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={Math.abs(factor.max)}
                    value={weights[factor.key]}
                    onChange={(e) => setWeights({ ...weights, [factor.key]: Number(e.target.value) })}
                    className="w-full h-1"
                    style={{ accentColor: factor.color }}
                  />
                </div>
              ))}
            </div>

            {/* Preview score */}
            <div className="mt-3 flex items-center gap-3 rounded-lg border border-aqua/15 bg-aqua/[0.03] p-3">
              <span className="font-mono text-[11px] text-mist">Preview max score:</span>
              <span className="num font-display text-xl font-700 text-aqua">
                {Object.entries(weights)
                  .filter(([k]) => k !== 'negative')
                  .reduce((sum, [, v]) => sum + v, 0)}
              </span>
              <span className="font-mono text-[10px] text-dusk">points possible</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-ink/[0.06]">
            <button onClick={() => setShowCreate(false)} className="rounded-lg border border-ink/[0.06] px-4 py-2 font-mono text-[11px] text-dusk hover:text-mist">Cancel</button>
            <button
              onClick={() => createMutation.mutate()}
              disabled={!newName.trim() || createMutation.isPending}
              className="rounded-lg bg-aqua/10 px-4 py-2 font-mono text-[11px] font-500 text-aqua ring-1 ring-aqua/20 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Saving…' : 'Save ICP Profile'}
            </button>
          </div>
        </Card>
      )}

      {/* Profile list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
      ) : profiles.length === 0 && !showCreate ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Target className="h-10 w-10 text-dusk" />
          <p className="text-[14px] font-500 text-mist">No ICP profiles yet</p>
          <p className="font-mono text-[11px] text-dusk">Create an ICP to improve lead scoring accuracy</p>
        </div>
      ) : (
        <div className="space-y-3">
          {profiles.map((profile) => (
            <ICPProfileCard
              key={profile.id}
              profile={profile}
              expanded={expandedId === profile.id}
              onToggle={() => setExpandedId(expandedId === profile.id ? null : profile.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ICPProfileCard({
  profile,
  expanded,
  onToggle,
}: {
  profile: ICPProfile;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={cn(
      'rounded-xl border bg-surface transition-all',
      profile.isActive ? 'border-jade/15' : 'border-ink/[0.06]',
    )}>
      <div className="flex cursor-pointer items-center gap-3 p-4" onClick={onToggle}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-aqua/10">
          <Target className="h-4 w-4 text-aqua" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-[14px] font-600 text-ink">{profile.name}</h3>
            <span className="font-mono text-[9px] text-dusk">v{profile.version}</span>
            {profile.isActive && (
              <span className="rounded-full bg-jade/10 px-2 py-0.5 font-mono text-[9px] text-jade">Active</span>
            )}
          </div>
          <p className="font-mono text-[10px] text-dusk mt-0.5">
            {profile.config?.targetRoles?.slice(0, 3).join(', ') || 'No roles configured'}
            {(profile.config?.targetRoles?.length ?? 0) > 3 && ` +${(profile.config?.targetRoles?.length ?? 0) - 3} more`}
          </p>
        </div>
        {profile.conversionRate !== undefined && (
          <div className="text-right mr-2">
            <p className="num font-mono text-[14px] font-600 text-jade">{(profile.conversionRate * 100).toFixed(1)}%</p>
            <p className="font-mono text-[9px] text-dusk">conv. rate</p>
          </div>
        )}
        {expanded ? <ChevronDown className="h-4 w-4 text-dusk shrink-0" /> : <ChevronRight className="h-4 w-4 text-dusk shrink-0" />}
      </div>

      {expanded && profile.config && (
        <div className="border-t border-ink/[0.06] p-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {[
              { label: 'Target Roles',    tags: profile.config.targetRoles },
              { label: 'Industries',      tags: profile.config.targetIndustries },
              { label: 'Locations',       tags: profile.config.targetLocations },
              { label: 'Company Stages',  tags: profile.config.targetStages },
              { label: 'Buyer Signals',   tags: profile.config.buyerSignals },
              { label: 'Budget Signals',  tags: profile.config.budgetSignals },
            ].map(({ label, tags }) =>
              tags && tags.length > 0 ? (
                <div key={label}>
                  <p className="section-label mb-1.5">{label}</p>
                  <div className="flex flex-wrap gap-1">
                    {tags.slice(0, 5).map((tag) => (
                      <span key={tag} className="rounded-md bg-elevated px-1.5 py-0.5 font-mono text-[9px] text-mist">{tag}</span>
                    ))}
                    {tags.length > 5 && (
                      <span className="font-mono text-[9px] text-dusk">+{tags.length - 5}</span>
                    )}
                  </div>
                </div>
              ) : null,
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tag input component ────────────────────────────────────────────────────────

function TagInputSingle({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="section-label mb-1.5 block">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-ink/[0.06] bg-elevated px-3 py-2 font-mono text-[12px] text-ink focus:border-aqua/30 focus:outline-none"
        placeholder={placeholder}
      />
    </div>
  );
}

function TagInputMulti({ label, tags, onChange, placeholder }: {
  label: string; tags: string[]; onChange: (v: string[]) => void; placeholder?: string;
}) {
  const [input, setInput] = useState('');

  const addTag = () => {
    if (!input.trim()) return;
    onChange([...tags, input.trim()]);
    setInput('');
  };

  return (
    <div>
      <label className="section-label mb-1.5 block">{label}</label>
      <div className="rounded-lg border border-ink/[0.06] bg-elevated p-2 min-h-[60px]">
        <div className="flex flex-wrap gap-1 mb-1.5">
          {tags.map((tag) => (
            <span key={tag} className="flex items-center gap-1 rounded-md bg-aqua/10 px-2 py-0.5 font-mono text-[10px] text-aqua">
              {tag}
              <button onClick={() => onChange(tags.filter((t) => t !== tag))}>
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }}
          className="w-full bg-transparent font-mono text-[11px] text-ink placeholder:text-dusk focus:outline-none"
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}

function TagInput(props:
  | { label: string; value: string; onChange: (v: string) => void; placeholder?: string; single: true }
  | { label: string; tags: string[]; onChange: (v: string[]) => void; placeholder?: string; single?: false }
) {
  if (props.single) {
    return <TagInputSingle label={props.label} value={props.value} onChange={props.onChange} placeholder={props.placeholder} />;
  }
  return <TagInputMulti label={props.label} tags={props.tags} onChange={props.onChange} placeholder={props.placeholder} />;
}

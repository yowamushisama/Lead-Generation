'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Target, ChevronDown, ChevronRight, X, Sparkles, Loader2, Pencil, Map } from 'lucide-react';
import { icp as icpApi } from '@/lib/api-client';
import type { ICPProfile, ICPConfig, GmapsFiltersWithEnabled, WebsitePresenceMode } from '@/models';
import { Card } from '@/components/ui/card';
import { TagInput } from '@/components/ui/tag-input';
import { cn, mergeUnique } from '@/lib/utils';
import { SCORING_FACTORS, COMPANY_STAGES } from '@/constants';

const EMPTY_CONFIG: ICPConfig = {
  targetRoles: [],
  targetIndustries: [],
  targetStages: [],
  targetLocations: [],
  buyerSignals: [],
  urgencySignals: [],
  budgetSignals: [],
};

const DEFAULT_WEIGHTS = Object.fromEntries(SCORING_FACTORS.map((f) => [f.key, Math.abs(f.max)]));


export function ICPBuilder() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newIsActive, setNewIsActive] = useState(true);
  const [newConfig, setNewConfig] = useState<ICPConfig>(EMPTY_CONFIG);
  const [weights, setWeights] = useState<Record<string, number>>(DEFAULT_WEIGHTS);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);

  // ── Form lifecycle ──────────────────────────────────────────────────────────

  const handleCloseForm = () => {
    setShowCreate(false);
    setEditingId(null);
    setNewName('');
    setNewIsActive(true);
    setNewConfig(EMPTY_CONFIG);
    setWeights(DEFAULT_WEIGHTS);
    setEnhanceError(null);
  };

  const handleStartEdit = (profile: ICPProfile) => {
    setEditingId(profile.id);
    setShowCreate(false);
    setExpandedId(null);
    setNewName(profile.name);
    setNewIsActive(profile.isActive);
    // Spread full config so sourceFilters (and any future keys) are preserved.
    setNewConfig({ ...EMPTY_CONFIG, ...profile.config });
  };

  // ── AI enhance — merges suggestions into existing fields ────────────────────

  const handleEnhance = async () => {
    if (!newName.trim() || isEnhancing) return;
    setIsEnhancing(true);
    setEnhanceError(null);
    try {
      const suggested = await icpApi.enhance(newName.trim());
      setNewConfig((prev) => ({
        ...prev,  // preserves sourceFilters and any future per-source keys
        targetRoles:      mergeUnique(prev.targetRoles      ?? [], suggested.targetRoles),
        targetIndustries: mergeUnique(prev.targetIndustries ?? [], suggested.targetIndustries),
        targetLocations:  mergeUnique(prev.targetLocations  ?? [], suggested.targetLocations),
        targetStages:     mergeUnique(
          prev.targetStages ?? [],
          (suggested.targetStages ?? []).filter((s): s is typeof COMPANY_STAGES[number] => (COMPANY_STAGES as readonly string[]).includes(s)),
        ),
        buyerSignals:     mergeUnique(prev.buyerSignals     ?? [], suggested.buyerSignals),
        urgencySignals:   mergeUnique(prev.urgencySignals   ?? [], suggested.urgencySignals),
        budgetSignals:    mergeUnique(prev.budgetSignals    ?? [], suggested.budgetSignals),
      }));
    } catch {
      setEnhanceError('AI enhancement failed. Please try again.');
    } finally {
      setIsEnhancing(false);
    }
  };

  // ── Google Maps filter helpers ───────────────────────────────────────────────

  const gmapsFilters = newConfig.sourceFilters?.googleMaps;
  const gmapsEnabled = gmapsFilters?.enabled ?? false;

  const updateGmapsFilters = (partial: Partial<GmapsFiltersWithEnabled>) => {
    setNewConfig((prev) => ({
      ...prev,
      sourceFilters: {
        ...prev.sourceFilters,
        googleMaps: {
          enabled: false,
          ...prev.sourceFilters?.googleMaps,
          ...partial,
        },
      },
    }));
  };

  // ── Data & mutations ────────────────────────────────────────────────────────

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['icp'],
    queryFn: () => icpApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: () => icpApi.create({ name: newName, config: newConfig }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['icp'] });
      handleCloseForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      icpApi.update(editingId!, { name: newName, config: newConfig, isActive: newIsActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['icp'] });
      handleCloseForm();
    },
  });

  const isEditing   = editingId !== null;
  const isSaving    = createMutation.isPending || updateMutation.isPending;
  const showForm    = showCreate || isEditing;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-700 text-ink">ICP Builder</h1>
          <p className="mt-0.5 font-mono text-[11px] text-mist">Configure Ideal Customer Profiles</p>
        </div>
        <button
          onClick={() => { handleCloseForm(); setShowCreate(true); }}
          className="flex items-center gap-2 rounded-lg bg-aqua/10 px-4 py-2 font-mono text-[12px] font-500 text-aqua ring-1 ring-aqua/20 hover:bg-aqua/15 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New ICP
        </button>
      </div>

      {/* Create / Edit panel */}
      {showForm && (
        <Card className="border-aqua/15 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-[14px] font-600 text-ink">
              {isEditing ? 'Edit ICP Profile' : 'New ICP Profile'}
            </h2>
            <button
              onClick={handleCloseForm}
              className="flex items-center justify-center h-7 w-7 rounded-lg border border-ink/[0.08] bg-elevated text-dusk hover:border-ink/20 hover:text-mist transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-3">
              {/* Profile Name with AI enhancer icon */}
              <div>
                <label className="section-label mb-1.5 block">Profile Name</label>
                <div className="relative">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full rounded-lg border border-ink/[0.06] bg-elevated px-3 py-2 pr-10 font-mono text-[12px] text-ink focus:border-aqua/30 focus:outline-none placeholder:text-dusk"
                    placeholder="Enterprise SaaS CTOs"
                  />
                  {/* AI enhance button */}
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <div className="group/tooltip relative">
                      <button
                        type="button"
                        disabled={!newName.trim() || isEnhancing}
                        onClick={handleEnhance}
                        className={cn(
                          'flex items-center justify-center h-6 w-6 rounded-md transition-all',
                          !newName.trim() || isEnhancing
                            ? 'cursor-not-allowed text-dusk/40'
                            : 'cursor-pointer text-orchid hover:bg-orchid/10',
                        )}
                      >
                        {isEnhancing
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Sparkles className="h-3.5 w-3.5" />
                        }
                      </button>
                      <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 z-50 whitespace-nowrap rounded-md border border-ink/[0.08] bg-overlay px-2 py-1 font-mono text-[10px] text-mist opacity-0 shadow-lg transition-opacity duration-150 group-hover/tooltip:opacity-100">
                        AI-fill fields from profile name (keeps existing)
                      </span>
                    </div>
                  </div>
                </div>
                {enhanceError && (
                  <p className="mt-1 font-mono text-[10px] text-crimson">{enhanceError}</p>
                )}
              </div>

              {/* isActive toggle — edit mode only */}
              {isEditing && (
                <label className="flex items-center gap-2 font-mono text-[11px] text-mist cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newIsActive}
                    onChange={(e) => setNewIsActive(e.target.checked)}
                    className="rounded"
                  />
                  Mark as active profile
                </label>
              )}

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
                            : 'border-ink/[0.06] text-mist hover:text-ink',
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
            <div className="mt-3 flex items-center gap-3 rounded-lg border border-aqua/15 bg-aqua/[0.03] p-3">
              <span className="font-mono text-[11px] text-mist">Preview max score:</span>
              <span className="num font-display text-xl font-700 text-aqua">
                {Object.entries(weights)
                  .filter(([k]) => k !== 'negative')
                  .reduce((sum, [, v]) => sum + v, 0)}
              </span>
              <span className="font-mono text-[10px] text-mist">points possible</span>
            </div>
          </div>

          {/* Google Maps source-specific targeting */}
          <div className="mt-4 border-t border-ink/[0.06] pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Map className="h-3.5 w-3.5 text-mist" />
                <h3 className="font-display text-[12px] font-600 text-ink">Google Maps Targeting</h3>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className="font-mono text-[10px] text-mist">Enable filters</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={gmapsEnabled}
                    onChange={(e) => updateGmapsFilters({ enabled: e.target.checked })}
                    className="sr-only"
                  />
                  <div
                    className={cn(
                      'h-4 w-7 rounded-full transition-colors',
                      gmapsEnabled ? 'bg-aqua' : 'bg-ink/20',
                    )}
                  />
                  <div
                    className={cn(
                      'absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform shadow-sm',
                      gmapsEnabled ? 'translate-x-3.5' : 'translate-x-0.5',
                    )}
                  />
                </div>
              </label>
            </div>

            {gmapsEnabled && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 rounded-lg border border-aqua/10 bg-aqua/[0.02] p-3">
                {/* Min rating */}
                <div>
                  <label className="section-label mb-1 block">Min Rating</label>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    step={0.1}
                    value={gmapsFilters?.minRating ?? ''}
                    onChange={(e) => updateGmapsFilters({ minRating: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="e.g. 3.9"
                    className="w-full rounded-lg border border-ink/[0.06] bg-elevated px-3 py-1.5 font-mono text-[12px] text-ink focus:border-aqua/30 focus:outline-none placeholder:text-dusk"
                  />
                </div>

                {/* Min reviews */}
                <div>
                  <label className="section-label mb-1 block">Min Reviews</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={gmapsFilters?.minReviewCount ?? ''}
                    onChange={(e) => updateGmapsFilters({ minReviewCount: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                    placeholder="e.g. 10"
                    className="w-full rounded-lg border border-ink/[0.06] bg-elevated px-3 py-1.5 font-mono text-[12px] text-ink focus:border-aqua/30 focus:outline-none placeholder:text-dusk"
                  />
                </div>

                {/* Min years in business */}
                <div>
                  <label className="section-label mb-1 block">Min Years in Business</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={gmapsFilters?.minYearsInBusiness ?? ''}
                    onChange={(e) => updateGmapsFilters({ minYearsInBusiness: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                    placeholder="e.g. 2"
                    className="w-full rounded-lg border border-ink/[0.06] bg-elevated px-3 py-1.5 font-mono text-[12px] text-ink focus:border-aqua/30 focus:outline-none placeholder:text-dusk"
                  />
                  <p className="mt-0.5 font-mono text-[10px] text-dusk">Strict — leads without a confirmed value are excluded. Expect higher drop rate.</p>
                </div>

                {/* Website presence */}
                <div>
                  <label className="section-label mb-1 block">Website Presence</label>
                  <div className="flex flex-col gap-1">
                    {(
                      [
                        { value: 'any', label: 'Any', desc: 'No website filter' },
                        { value: 'none', label: 'No website', desc: 'Only businesses with no website' },
                        { value: 'none_or_social_only', label: 'None or social-only', desc: 'No website or only Facebook/Instagram/etc.' },
                      ] as { value: WebsitePresenceMode; label: string; desc: string }[]
                    ).map(({ value, label, desc }) => (
                      <label key={value} className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="websitePresence"
                          value={value}
                          checked={(gmapsFilters?.websitePresence ?? 'any') === value}
                          onChange={() => updateGmapsFilters({ websitePresence: value })}
                          className="mt-0.5"
                        />
                        <span>
                          <span className="font-mono text-[11px] text-ink">{label}</span>
                          <span className="block font-mono text-[10px] text-dusk">{desc}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  {(gmapsFilters?.websitePresence === 'none' || gmapsFilters?.websitePresence === 'none_or_social_only') && (
                    <p className="mt-1 font-mono text-[10px] text-amber-400/80">Requires detail extraction — scraping will be slower.</p>
                  )}
                </div>
              </div>
            )}

            {!gmapsEnabled && (
              <p className="font-mono text-[10px] text-dusk">Enable to filter Google Maps leads by rating, review count, business age, and website presence.</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-ink/[0.06]">
            <button
              onClick={handleCloseForm}
              className="rounded-lg border border-ink/[0.06] px-4 py-2 font-mono text-[11px] text-mist hover:text-ink"
            >
              Cancel
            </button>
            <button
              onClick={() => isEditing ? updateMutation.mutate() : createMutation.mutate()}
              disabled={!newName.trim() || isSaving}
              className="rounded-lg bg-aqua/10 px-4 py-2 font-mono text-[11px] font-500 text-aqua ring-1 ring-aqua/20 disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : isEditing ? 'Save Changes' : 'Save ICP Profile'}
            </button>
          </div>
        </Card>
      )}

      {/* Profile list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
      ) : profiles.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Target className="h-10 w-10 text-mist" />
          <p className="text-[14px] font-500 text-mist">No ICP profiles yet</p>
          <p className="font-mono text-[11px] text-mist">Create an ICP to improve lead scoring accuracy</p>
        </div>
      ) : (
        <div className="space-y-3">
          {profiles.map((profile) => (
            <ICPProfileCard
              key={profile.id}
              profile={profile}
              expanded={expandedId === profile.id}
              onToggle={() => setExpandedId(expandedId === profile.id ? null : profile.id)}
              onEdit={() => handleStartEdit(profile)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── ICPProfileCard ────────────────────────────────────────────────────────────

function ICPProfileCard({
  profile,
  expanded,
  onToggle,
  onEdit,
}: {
  profile: ICPProfile;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
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
            <span className="font-mono text-[9px] text-mist">v{profile.version}</span>
            {profile.isActive && (
              <span className="rounded-full bg-jade/10 px-2 py-0.5 font-mono text-[9px] text-jade">Active</span>
            )}
          </div>
          <p className="font-mono text-[10px] text-mist mt-0.5">
            {profile.config?.targetRoles?.slice(0, 3).join(', ') || 'No roles configured'}
            {(profile.config?.targetRoles?.length ?? 0) > 3 && ` +${(profile.config?.targetRoles?.length ?? 0) - 3} more`}
          </p>
        </div>

        {profile.conversionRate !== undefined && (
          <div className="text-right mr-2">
            <p className="num font-mono text-[14px] font-600 text-jade">{(profile.conversionRate * 100).toFixed(1)}%</p>
            <p className="font-mono text-[9px] text-mist">conv. rate</p>
          </div>
        )}

        {/* Edit button */}
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="flex items-center gap-1 rounded-md border border-ink/[0.06] px-2 py-1 font-mono text-[10px] text-dusk hover:text-mist hover:border-ink/20 transition-colors shrink-0"
        >
          <Pencil className="h-3 w-3" />
          Edit
        </button>

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
                      <span className="font-mono text-[9px] text-mist">+{tags.length - 5}</span>
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

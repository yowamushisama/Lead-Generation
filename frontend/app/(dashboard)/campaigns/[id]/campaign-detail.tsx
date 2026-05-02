'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Pause, Play, Archive, Settings,
  BarChart2, Users, MessageSquare, Wand2, Zap, X,
} from 'lucide-react';
import { campaigns as campaignsApi, ApiError } from '@/lib/api-client';
import type { Campaign, CampaignStatus, CampaignRunSummary } from '@/models';
import { cn } from '@/lib/utils';
import { CAMPAIGN_STATUS_CONFIG } from '@/constants';
import { OverviewTab }      from '../components/overview-tab';
import { LeadsTab }         from '../components/leads-tab';
import { MessagesTab }      from '../components/messages-tab';
import { SettingsTab }      from '../components/settings-tab';
import { PromptConfigTab }  from './components/prompt-config-tab';

type Tab = 'overview' | 'leads' | 'messages' | 'settings' | 'prompts';

const TABS: { id: Tab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'overview',  label: 'Overview',  icon: BarChart2 },
  { id: 'leads',     label: 'Leads',     icon: Users },
  { id: 'messages',  label: 'Messages',  icon: MessageSquare },
  { id: 'prompts',   label: 'Prompts',   icon: Wand2 },
  { id: 'settings',  label: 'Settings',  icon: Settings },
];

export function CampaignDetail({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [runResult, setRunResult] = useState<CampaignRunSummary | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => campaignsApi.get(id),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['campaign', id] });

  const launchMutation  = useMutation({ mutationFn: () => campaignsApi.launch(id),  onSuccess: invalidate });
  const pauseMutation   = useMutation({ mutationFn: () => campaignsApi.pause(id),   onSuccess: invalidate });
  const resumeMutation  = useMutation({ mutationFn: () => campaignsApi.resume(id),  onSuccess: invalidate });
  const archiveMutation = useMutation({ mutationFn: () => campaignsApi.archive(id), onSuccess: invalidate });
  const runMutation = useMutation({
    mutationFn: () => campaignsApi.run(id),
    onSuccess: (summary) => {
      setRunResult(summary);
      setRunError(null);
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['campaign-performance', id] });
    },
    onError: (error) => {
      setRunResult(null);
      setRunError(error instanceof ApiError ? error.message : 'Failed to run campaign');
    },
  });

  if (isLoading || !campaign) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="skeleton h-6 w-48 rounded-lg" />
        <div className="skeleton h-10 w-80 rounded-lg" />
        <div className="skeleton h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <BackNav />
      <Header
        campaign={campaign}
        onLaunch={() => launchMutation.mutate()}
        onPause={() => pauseMutation.mutate()}
        onResume={() => resumeMutation.mutate()}
        onArchive={() => archiveMutation.mutate()}
        onSettings={() => setActiveTab('settings')}
        onRun={() => runMutation.mutate()}
        runPending={runMutation.isPending}
        actionPending={launchMutation.isPending || pauseMutation.isPending || resumeMutation.isPending || archiveMutation.isPending || runMutation.isPending}
      />
      {(runResult || runError) && (
        <RunResultBanner
          result={runResult}
          error={runError}
          onDismiss={() => { setRunResult(null); setRunError(null); }}
        />
      )}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      <TabContent
        activeTab={activeTab}
        campaignId={id}
        campaign={campaign}
        onSaved={invalidate}
      />
    </div>
  );
}

// ── BackNav ───────────────────────────────────────────────────────────────────

function BackNav() {
  return (
    <Link
      href="/campaigns"
      className="inline-flex items-center gap-1.5 font-mono text-[11px] text-dusk hover:text-mist transition-colors"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Back to Campaigns
    </Link>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

function Header({
  campaign,
  onLaunch,
  onPause,
  onResume,
  onArchive,
  onSettings,
  onRun,
  runPending,
  actionPending,
}: {
  campaign: Campaign;
  onLaunch: () => void;
  onPause: () => void;
  onResume: () => void;
  onArchive: () => void;
  onSettings: () => void;
  onRun: () => void;
  runPending: boolean;
  actionPending: boolean;
}) {
  const sc = CAMPAIGN_STATUS_CONFIG[campaign.status as CampaignStatus] ?? CAMPAIGN_STATUS_CONFIG.DRAFT;
  const isActive   = campaign.status === 'ACTIVE';
  const isPaused   = campaign.status === 'PAUSED';
  const isDraft    = campaign.status === 'DRAFT';
  const isArchived = campaign.status === 'ARCHIVED';

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-display text-xl font-700 text-ink">{campaign.name}</h1>
          <StatusBadge status={campaign.status as CampaignStatus} sc={sc} />
        </div>
        {campaign.description && (
          <p className="mt-1 font-mono text-[12px] text-dusk">{campaign.description}</p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        {isActive && (
          <ActionButton
            onClick={onRun}
            disabled={actionPending}
            icon={Zap}
            color="aqua"
            label={runPending ? 'Running…' : 'Run Now'}
          />
        )}
        {isActive && (
          <ActionButton
            onClick={onPause}
            disabled={actionPending}
            icon={Pause}
            color="gold"
            label="Pause"
          />
        )}
        {isDraft && (
          <ActionButton
            onClick={onLaunch}
            disabled={actionPending}
            icon={Play}
            color="jade"
            label="Launch"
          />
        )}
        {isPaused && (
          <ActionButton
            onClick={onResume}
            disabled={actionPending}
            icon={Play}
            color="jade"
            label="Resume"
          />
        )}
        {(isPaused || isDraft) && !isArchived && (
          <ActionButton
            onClick={onArchive}
            disabled={actionPending}
            icon={Archive}
            color="dusk"
            label="Archive"
          />
        )}
        <ActionButton
          onClick={onSettings}
          disabled={false}
          icon={Settings}
          color="dusk"
          label="Settings"
        />
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  sc,
}: {
  status: string;
  sc: { bg: string; text: string; dot: string };
}) {
  return (
    <span className={cn(
      'flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[10px]',
      sc.bg, sc.text,
    )}>
      <span className={cn('h-1.5 w-1.5 rounded-full', sc.dot)} />
      {status}
    </span>
  );
}

function ActionButton({
  onClick,
  disabled,
  icon: Icon,
  color,
  label,
}: {
  onClick: () => void;
  disabled: boolean;
  icon: React.FC<{ className?: string }>;
  color: 'gold' | 'jade' | 'dusk' | 'aqua';
  label: string;
}) {
  const colorCls = {
    gold: 'border-gold/20 text-gold hover:bg-gold/5',
    jade: 'border-jade/20 text-jade hover:bg-jade/5',
    aqua: 'border-aqua/20 text-aqua hover:bg-aqua/5',
    dusk: 'border-ink/[0.06] text-dusk hover:text-mist',
  }[color];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-[11px] transition-colors disabled:opacity-50',
        colorCls,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

// ── RunResultBanner ──────────────────────────────────────────────────────────

function RunResultBanner({
  result,
  error,
  onDismiss,
}: {
  result: CampaignRunSummary | null;
  error: string | null;
  onDismiss: () => void;
}) {
  if (error) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-lg border border-rose/20 bg-rose/5 px-4 py-3">
        <div className="font-mono text-[12px] text-rose">
          <span className="font-600">Run failed:</span> {error}
        </div>
        <button
          onClick={onDismiss}
          className="text-rose/70 hover:text-rose transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (!result) return null;

  const used = result.adaptersUsed.length > 0 ? result.adaptersUsed.join(', ') : 'no adapters';
  const skipped = result.skippedAdapters
    .map((s) => `${s.adapter} (${s.reason})`)
    .join(', ');

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-aqua/20 bg-aqua/5 px-4 py-3">
      <div className="font-mono text-[12px] text-mist space-y-1">
        <div>
          <span className="text-aqua font-600">Run started.</span>{' '}
          <span className="text-ink">{result.enqueued}</span> lead{result.enqueued === 1 ? '' : 's'} enqueued from <span className="text-ink">{used}</span>.
        </div>
        {skipped && (
          <div className="text-dusk">Skipped: {skipped}</div>
        )}
        <div className="text-dusk">Leads will progress through the pipeline over the next few minutes.</div>
      </div>
      <button
        onClick={onDismiss}
        className="text-dusk hover:text-mist transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── TabBar ────────────────────────────────────────────────────────────────────

function TabBar({ activeTab, onTabChange }: { activeTab: Tab; onTabChange: (t: Tab) => void }) {
  return (
    <div className="flex items-center gap-1 border-b border-ink/[0.06]">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onTabChange(id)}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2.5 font-mono text-[11px] border-b-2 -mb-px transition-colors',
            activeTab === id
              ? 'text-aqua border-aqua'
              : 'text-dusk border-transparent hover:text-mist',
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

// ── TabContent ────────────────────────────────────────────────────────────────

function TabContent({
  activeTab,
  campaignId,
  campaign,
  onSaved,
}: {
  activeTab: Tab;
  campaignId: string;
  campaign: Campaign;
  onSaved: () => void;
}) {
  switch (activeTab) {
    case 'overview':  return <OverviewTab campaignId={campaignId} campaign={campaign} />;
    case 'leads':     return <LeadsTab campaignId={campaignId} />;
    case 'messages':  return <MessagesTab campaignId={campaignId} />;
    case 'prompts':   return <PromptConfigTab campaignId={campaignId} campaign={campaign} />;
    case 'settings':  return <SettingsTab campaign={campaign} onSaved={onSaved} />;
  }
}

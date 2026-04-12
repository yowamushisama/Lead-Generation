'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Users, Flame, MessageSquare, TrendingUp, Cpu, CheckCircle,
  AlertCircle, Database, Activity, Zap, Clock, RefreshCw,
  Link2, Map, FileSpreadsheet, Webhook,
} from 'lucide-react';
import { analytics, health, leads, messages } from '@/lib/api-client';
import { indicatorStatus } from '@/models/health';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { TierBadge, StatusBadge, SourceBadge } from '@/components/ui/badge';
import { ScoreBar } from '@/components/ui/score-bar';
import { formatPercent, formatNumber, relativeTime } from '@/lib/utils';

// ── Pipeline stage config ────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { id: 'intent',      label: 'Intent',      color: '#06B6D4' },
  { id: 'enrich',      label: 'Enrich',      color: '#7C3AED' },
  { id: 'score',       label: 'Score',       color: '#F59E0B' },
  { id: 'personalize', label: 'Personalize', color: '#F97316' },
  { id: 'outreach',    label: 'Outreach',    color: '#10B981' },
];

// ── Adapter config ───────────────────────────────────────────────────────────

const ADAPTERS = [
  { id: 'linkedin',    label: 'LinkedIn',    icon: Link2,         color: '#4A9EF5' },
  { id: 'google_maps', label: 'Maps',        icon: Map,           color: '#10B981' },
  { id: 'csv',         label: 'CSV',         icon: FileSpreadsheet, color: '#7C3AED' },
  { id: 'webhook',     label: 'Webhook',     icon: Webhook,       color: '#F59E0B' },
];

export function CommandCenter() {
  const dashQuery = useQuery({
    queryKey: ['analytics', 'dashboard'],
    queryFn: () => analytics.dashboard(),
    refetchInterval: 30_000,
  });

  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: () => health.full(),
    refetchInterval: 30_000,
  });

  const hotLeadsQuery = useQuery({
    queryKey: ['leads', 'hot-top'],
    queryFn: () => leads.list({ tier: 'HOT', limit: 5, page: 1 }),
    refetchInterval: 30_000,
  });

  const pendingQuery = useQuery({
    queryKey: ['messages', 'pending'],
    queryFn: () => messages.listPending(),
    refetchInterval: 30_000,
  });

  const dash = dashQuery.data;
  const sysHealth = healthQuery.data;
  const hotLeads = hotLeadsQuery.data?.data ?? [];
  const pendingCount = pendingQuery.data?.length ?? 0;

  const isHealthy = sysHealth?.status === 'ok';
  const isDegraded = sysHealth?.status === 'degraded';

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-700 text-ink">Command Center</h1>
          <p className="mt-0.5 font-mono text-[11px] text-dusk">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            {' · '}
            Real-time overview
          </p>
        </div>

        {/* System health pill */}
        <div
          className={[
            'flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-mono font-500',
            isHealthy
              ? 'border-jade/20 bg-jade/5 text-jade'
              : isDegraded
                ? 'border-gold/20 bg-gold/5 text-gold'
                : 'border-crimson/20 bg-crimson/5 text-crimson',
          ].join(' ')}
        >
          <span
            className={[
              'h-1.5 w-1.5 rounded-full',
              isHealthy ? 'bg-jade animate-pulse-dot' : isDegraded ? 'bg-gold animate-pulse-dot' : 'bg-crimson',
            ].join(' ')}
          />
          {healthQuery.isLoading ? 'Checking...' : isHealthy ? 'All Systems Operational' : isDegraded ? 'Degraded' : 'System Issue'}
        </div>
      </div>

      {/* ── KPI Row ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Total Leads"
          value={dash ? formatNumber(dash.leads.total) : '—'}
          subLabel="all time"
          icon={Users}
          accent="aqua"
          loading={dashQuery.isLoading}
          className="animate-fade-in delay-75"
        />
        <StatCard
          label="HOT Leads"
          value={dash ? formatNumber(dash.leads.hot) : '—'}
          subLabel="high intent"
          icon={Flame}
          accent="gold"
          loading={dashQuery.isLoading}
          className="animate-fade-in delay-100"
        />
        <StatCard
          label="Reply Rate"
          value={dash ? formatPercent(dash.outreach.replyRate) : '—'}
          subLabel="messages sent"
          icon={MessageSquare}
          accent="jade"
          loading={dashQuery.isLoading}
          className="animate-fade-in delay-150"
        />
        <StatCard
          label="Conversion"
          value={dash ? formatPercent(dash.outreach.conversionRate) : '—'}
          subLabel="replied → meeting"
          icon={TrendingUp}
          accent="tangerine"
          loading={dashQuery.isLoading}
          className="animate-fade-in delay-200"
        />
        <StatCard
          label="AI Tokens"
          value={dash ? formatNumber(Number(dash.usage?.aiTokensUsed) || 0) : '—'}
          subLabel="this period"
          icon={Cpu}
          accent="orchid"
          loading={dashQuery.isLoading}
          className="animate-fade-in delay-300"
        />
        <StatCard
          label="Pending"
          value={pendingCount}
          subLabel="need approval"
          icon={Clock}
          accent={pendingCount > 10 ? 'gold' : 'aqua'}
          loading={pendingQuery.isLoading}
          className="animate-fade-in delay-400"
        />
      </div>

      {/* ── Pipeline + Adapters row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

        {/* Pipeline flow visualization */}
        <div className="lg:col-span-2">
          <Card className="animate-fade-in delay-200">
            <CardHeader>
              <CardTitle>Pipeline Flow</CardTitle>
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-dusk">
                <Activity className="h-3 w-3 text-orchid" />
                Live
              </div>
            </CardHeader>

            <PipelineFlowViz byStatus={dash?.leads.byStatus} />
          </Card>
        </div>

        {/* Adapter status */}
        <Card className="animate-fade-in delay-300">
          <CardHeader>
            <CardTitle>Adapters</CardTitle>
            <RefreshCw className="h-3 w-3 text-dusk" />
          </CardHeader>

          <div className="space-y-2">
            {ADAPTERS.map((adapter) => (
              <AdapterStatusRow
                key={adapter.id}
                adapter={adapter}
                active={true}
              />
            ))}
          </div>
        </Card>
      </div>

      {/* ── Hot Leads + System Health ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

        {/* Top HOT leads */}
        <div className="lg:col-span-2">
          <Card className="animate-fade-in delay-300">
            <CardHeader>
              <CardTitle>Top HOT Leads</CardTitle>
              <span className="section-label">{hotLeads.length} shown</span>
            </CardHeader>

            {hotLeadsQuery.isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="skeleton h-12 rounded-lg" />
                ))}
              </div>
            ) : hotLeads.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-center">
                <div>
                  <Flame className="mx-auto mb-2 h-6 w-6 text-dusk" />
                  <p className="font-mono text-[11px] text-dusk">No HOT leads yet</p>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {hotLeads.map((lead, idx) => (
                  <HotLeadRow key={lead.id} lead={lead} rank={idx + 1} />
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* System health detail */}
        <Card className="animate-fade-in delay-400">
          <CardHeader>
            <CardTitle>System Health</CardTitle>
          </CardHeader>

          <div className="space-y-2.5">
            <HealthRow
              label="Database"
              icon={Database}
              status={indicatorStatus(sysHealth, 'database') ?? (healthQuery.isError ? 'error' : undefined)}
              loading={healthQuery.isLoading}
            />
            <HealthRow
              label="Redis"
              icon={Zap}
              status={indicatorStatus(sysHealth, 'redis') ?? (healthQuery.isError ? 'error' : undefined)}
              loading={healthQuery.isLoading}
            />
            <HealthRow
              label="Queues"
              icon={Activity}
              status={indicatorStatus(sysHealth, 'queues') ?? (healthQuery.isError ? 'error' : undefined)}
              loading={healthQuery.isLoading}
            />
            <HealthRow
              label="API"
              icon={CheckCircle}
              status={healthQuery.isError ? 'error' : sysHealth ? 'ok' : undefined}
              loading={healthQuery.isLoading}
            />

            {/* Lead tier breakdown */}
            {dash && (
              <div className="mt-4 space-y-1.5 border-t border-ink/[0.06] pt-4">
                <p className="section-label mb-2">Lead Breakdown</p>
                {(['HOT', 'WARM', 'COLD'] as const).map((tier) => {
                  const count = tier === 'HOT' ? dash.leads.hot
                    : tier === 'WARM' ? dash.leads.warm
                    : dash.leads.cold;
                  const pct = dash.leads.total > 0 ? (count / dash.leads.total) * 100 : 0;
                  return (
                    <div key={tier} className="flex items-center gap-2">
                      <span className="w-8 font-mono text-[9px] text-dusk">{tier}</span>
                      <div className="flex-1 rounded-full bg-ink/[0.06] h-1">
                        <div
                          className={
                            tier === 'HOT' ? 'h-1 rounded-full bg-gold' :
                            tier === 'WARM' ? 'h-1 rounded-full bg-tangerine' :
                            'h-1 rounded-full bg-aqua'
                          }
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="num w-8 text-right font-mono text-[10px] text-mist">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Pipeline Flow Visualization ──────────────────────────────────────────────

function PipelineFlowViz({ byStatus }: { byStatus?: Record<string, number> }) {
  const stages = [
    { key: 'NEW',             label: 'New',        color: '#94A3B8' },
    { key: 'ENRICHED',        label: 'Enriched',   color: '#06B6D4' },
    { key: 'SCORED',          label: 'Scored',     color: '#7C3AED' },
    { key: 'PERSONALIZED',    label: 'Personal.',  color: '#F97316' },
    { key: 'MESSAGE_DRAFTED', label: 'Drafted',    color: '#F59E0B' },
    { key: 'OUTREACH_SENT',   label: 'Sent',       color: '#10B981' },
    { key: 'CONVERTED',       label: 'Converted',  color: '#10B981' },
  ];

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max items-end gap-0">
        {stages.map((stage, idx) => {
          const count = byStatus?.[stage.key] ?? 0;
          const isLast = idx === stages.length - 1;
          const barH = Math.max(count > 0 ? Math.min((count / 50) * 80 + 8, 80) : 4, 4);

          return (
            <div key={stage.key} className="flex items-end">
              {/* Stage */}
              <div className="flex flex-col items-center gap-1.5">
                {/* Bar */}
                <div className="flex flex-col items-center justify-end" style={{ height: 90 }}>
                  <span className="mb-1 font-mono text-[10px] text-mist">{count}</span>
                  <div
                    className="w-12 rounded-t-sm transition-all duration-700"
                    style={{
                      height: barH,
                      background: count > 0
                        ? `linear-gradient(to top, ${stage.color}40, ${stage.color}90)`
                        : 'rgba(255,255,255,0.04)',
                      boxShadow: count > 0 ? `0 0 8px ${stage.color}30` : 'none',
                    }}
                  />
                </div>
                <span className="font-mono text-[9px] text-dusk">{stage.label}</span>
              </div>

              {/* Arrow connector */}
              {!isLast && (
                <div className="mb-6 flex items-center px-0.5">
                  <svg width="20" height="10" viewBox="0 0 20 10" fill="none">
                    <line
                      x1="0" y1="5" x2="14" y2="5"
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                      className="animate-flow-dash"
                    />
                    <path d="M14 2L18 5L14 8" stroke="rgba(255,255,255,0.15)" strokeWidth="1" fill="none" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Adapter status row ────────────────────────────────────────────────────────

function AdapterStatusRow({
  adapter,
  active,
}: {
  adapter: { id: string; label: string; icon: React.ComponentType<{ className?: string }>; color: string };
  active: boolean;
}) {
  const Icon = adapter.icon;
  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-ink/[0.03]">
      <div
        className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0"
        style={{ background: `${adapter.color}15`, color: adapter.color }}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <span className="flex-1 text-[12px] text-mist">{adapter.label}</span>
      <div className="flex items-center gap-1.5">
        <span className={active ? 'dot-live' : 'dot-idle'} />
        <span className="font-mono text-[9px] text-dusk">{active ? 'LIVE' : 'OFF'}</span>
      </div>
    </div>
  );
}

// ── Hot lead row ──────────────────────────────────────────────────────────────

function HotLeadRow({ lead, rank }: { lead: Parameters<typeof StatusBadge>[0] & {
  id: string; name: string | null; company: string | null; role: string | null;
  score: number | null; tier: import('@/models').LeadTier | null;
  source: string; status: import('@/models').LeadStatus; createdAt: string;
}; rank: number }) {
  return (
    <div className="row-hot flex items-center gap-3 rounded-r-lg px-3 py-2 hover:bg-ink/[0.03] transition-colors">
      <span className="num w-4 shrink-0 font-mono text-[10px] text-dusk">{rank}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-500 text-ink">
          {lead.company ?? lead.name ?? 'Unknown'}
        </p>
        {lead.role && (
          <p className="font-mono text-[10px] text-dusk truncate">{lead.role}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ScoreBar score={lead.score} tier={lead.tier} size="sm" />
        {lead.tier && <TierBadge tier={lead.tier} />}
      </div>
    </div>
  );
}

// ── Health row ────────────────────────────────────────────────────────────────

function HealthRow({
  label,
  icon: Icon,
  status,
  loading,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  status: 'ok' | 'error' | string | undefined;
  loading: boolean;
}) {
  const ok = status === 'ok';
  const unknown = status === undefined;
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="h-3.5 w-3.5 text-dusk shrink-0" />
      <span className="flex-1 text-[12px] text-mist">{label}</span>
      {loading || unknown ? (
        <div className="skeleton h-4 w-12 rounded" />
      ) : (
        <div className={`flex items-center gap-1 ${ok ? 'text-jade' : 'text-crimson'}`}>
          {ok
            ? <CheckCircle className="h-3 w-3" />
            : <AlertCircle className="h-3 w-3" />}
          <span className="font-mono text-[10px]">{ok ? 'OK' : 'ERR'}</span>
        </div>
      )}
    </div>
  );
}

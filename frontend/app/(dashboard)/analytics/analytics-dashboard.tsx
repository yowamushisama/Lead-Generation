'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie,
  Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Funnel, FunnelChart,
} from 'recharts';
import { TrendingUp, TrendingDown, Download } from 'lucide-react';
import { analytics } from '@/lib/api-client';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { cn, formatPercent, formatNumber } from '@/lib/utils';

const DAY_OPTIONS = [7, 14, 30, 90] as const;
type Days = typeof DAY_OPTIONS[number];

const TIER_COLORS = { HOT: '#F59E0B', WARM: '#F97316', COLD: '#06B6D4' };
const SOURCE_COLORS: Record<string, string> = {
  linkedin: '#4A9EF5',
  google_maps: '#10B981',
  csv: '#7C3AED',
  webhook: '#F59E0B',
  reddit: '#FF6B35',
};

const FUNNEL_STAGES = [
  { key: 'NEW',              label: 'New',          color: '#94A3B8' },
  { key: 'ENRICHED',        label: 'Enriched',     color: '#06B6D4' },
  { key: 'SCORED',          label: 'Scored',       color: '#7C3AED' },
  { key: 'MESSAGE_DRAFTED', label: 'Drafted',      color: '#F59E0B' },
  { key: 'OUTREACH_SENT',   label: 'Sent',         color: '#F97316' },
  { key: 'REPLIED',         label: 'Replied',      color: '#22D3EE' },
  { key: 'CONVERTED',       label: 'Converted',    color: '#10B981' },
];

export function AnalyticsDashboard() {
  const [days, setDays] = useState<Days>(30);

  const dashQuery  = useQuery({ queryKey: ['analytics', 'dashboard'], queryFn: () => analytics.dashboard() });
  const sourcesQuery = useQuery({ queryKey: ['analytics', 'sources'], queryFn: () => analytics.sources() });
  const trendQuery = useQuery({ queryKey: ['analytics', 'trend', days], queryFn: () => analytics.trend(days) });

  const dash    = dashQuery.data;
  const sources = sourcesQuery.data ?? [];
  const trend   = trendQuery.data ?? [];

  const totalTokens = Number(dash?.usage?.aiTokensUsed) || 0;

  const trendData = trend.map((row) => ({
    date: row.date.slice(5, 10),
    leads: row.leadsProcessed ?? 0,
    tokens: Number(row.aiTokensUsed) || 0,
  }));

  const sourceData = sources.map((s) => ({
    name: s.source === 'google_maps' ? 'Maps' : s.source.charAt(0).toUpperCase() + s.source.slice(1),
    value: s.count,
    source: s.source,
  }));

  const funnelData = FUNNEL_STAGES.map((stage, idx) => ({
    ...stage,
    value: dash?.leads.byStatus?.[stage.key] ?? 0,
    fill: stage.color,
  }));

  const isLoading = dashQuery.isLoading;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-700 text-ink">Analytics</h1>
          <p className="mt-0.5 font-mono text-[11px] text-dusk">Performance overview · last {days} days</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Day range picker */}
          <div className="flex rounded-lg border border-ink/[0.06] bg-surface overflow-hidden">
            {DAY_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={cn(
                  'px-3 py-1.5 font-mono text-[11px] transition-colors',
                  days === d ? 'bg-aqua/10 text-aqua' : 'text-dusk hover:text-mist',
                )}
              >
                {d}d
              </button>
            ))}
          </div>
          <button className="flex items-center gap-1.5 rounded-lg border border-ink/[0.06] bg-surface px-3 py-2 font-mono text-[11px] text-dusk hover:text-mist transition-colors">
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total Leads"
          value={dash ? formatNumber(dash.leads.total) : '—'}
          icon={TrendingUp}
          accent="aqua"
          loading={isLoading}
        />
        <StatCard
          label="HOT Leads"
          value={dash ? dash.leads.hot : '—'}
          subLabel={dash ? `${Math.round((dash.leads.hot / Math.max(dash.leads.total, 1)) * 100)}% of total` : undefined}
          accent="gold"
          loading={isLoading}
          trendUp={true}
          trend="+12%"
        />
        <StatCard
          label="Reply Rate"
          value={dash ? formatPercent(dash.outreach.replyRate) : '—'}
          accent="jade"
          loading={isLoading}
          trendUp={dash ? dash.outreach.replyRate > 0.1 : undefined}
          trend={dash ? (dash.outreach.replyRate > 0.1 ? '▲ good' : '▼ low') : undefined}
        />
        <StatCard
          label="Conversion Rate"
          value={dash ? formatPercent(dash.outreach.conversionRate) : '—'}
          subLabel="replied → meeting"
          accent="tangerine"
          loading={isLoading}
        />
      </div>

      {/* Funnel + Trend */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Pipeline funnel */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Pipeline Funnel</CardTitle>
              <span className="section-label">NEW → CONVERTED</span>
            </CardHeader>
            <div className="space-y-1.5 pt-2">
              {funnelData.map((stage, idx) => {
                const maxVal = funnelData[0]?.value ?? 1;
                const pct = maxVal > 0 ? (stage.value / maxVal) * 100 : 0;
                const prevVal = idx > 0 ? (funnelData[idx - 1]?.value ?? 0) : stage.value;
                const dropOff = prevVal > 0 ? (1 - stage.value / prevVal) * 100 : 0;
                return (
                  <div key={stage.key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[10px] text-mist">{stage.label}</span>
                      <div className="flex items-center gap-2">
                        {idx > 0 && dropOff > 0 && (
                          <span className="font-mono text-[9px] text-crimson/70">-{dropOff.toFixed(0)}%</span>
                        )}
                        <span className="num font-mono text-[11px] text-ink">{stage.value}</span>
                      </div>
                    </div>
                    <div className="h-5 w-full overflow-hidden rounded-sm bg-ink/[0.04]">
                      <div
                        className="h-full rounded-sm transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          background: `linear-gradient(to right, ${stage.color}60, ${stage.color}90)`,
                          boxShadow: stage.value > 0 ? `0 0 6px ${stage.color}30` : 'none',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Daily trend area chart */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Lead Volume Trend</CardTitle>
              <span className="section-label">{days}-day window</span>
            </CardHeader>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="leadsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip
                    contentStyle={{ background: '#1A1A24', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: '#94A3B8' }}
                  />
                  <Area type="monotone" dataKey="leads" stroke="#06B6D4" strokeWidth={2} fill="url(#leadsGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </Card>
        </div>
      </div>

      {/* Source breakdown + Token usage */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Source donut */}
        <Card>
          <CardHeader>
            <CardTitle>Source Breakdown</CardTitle>
          </CardHeader>
          {sourceData.some((d) => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={sourceData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                  {sourceData.map((entry) => (
                    <Cell key={entry.source} fill={SOURCE_COLORS[entry.source] ?? '#475569'} />
                  ))}
                </Pie>
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1A1A24', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </Card>

        {/* AI token usage bar chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>AI Token Usage</CardTitle>
            <span className="section-label num">{formatNumber(totalTokens)} total</span>
          </CardHeader>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trendData.slice(-14)}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} width={35} />
                <Tooltip contentStyle={{ background: '#1A1A24', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="tokens" fill="#7C3AED" radius={[3, 3, 0, 0]} opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </Card>
      </div>

      {/* Outreach stats */}
      {dash && (
        <Card>
          <CardHeader>
            <CardTitle>Outreach Performance</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: 'Messages Sent',   value: dash.outreach.messagesSent, color: 'text-aqua' },
              { label: 'Replies',         value: Math.round(dash.outreach.messagesSent * dash.outreach.replyRate), color: 'text-jade' },
              { label: 'Meetings',        value: Math.round(dash.outreach.messagesSent * dash.outreach.conversionRate * 0.5), color: 'text-gold' },
              { label: 'Conversions',     value: Math.round(dash.leads.total * dash.outreach.conversionRate), color: 'text-tangerine' },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <p className={cn('num font-display text-3xl font-700', color)}>{value}</p>
                <p className="mt-1 font-mono text-[11px] text-dusk">{label}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[200px] items-center justify-center">
      <p className="font-mono text-[11px] text-dusk">No data yet — leads will appear here once the pipeline runs</p>
    </div>
  );
}

'use client';

import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Users, Send, TrendingUp, BarChart2 } from 'lucide-react';
import { campaigns as campaignsApi } from '@/lib/api-client';
import type { Campaign, CampaignPerformance } from '@/models';
import { StatCard } from '@/components/ui/stat-card';
import { formatPercent } from '@/lib/utils';
import {
  LEAD_PIPELINE_STAGES,
  MESSAGE_DELIVERY_STAGES,
  PIPELINE_STAGE_COLORS,
  MESSAGE_STAGE_COLORS,
} from '@/constants';

const TOOLTIP_STYLE = {
  background: 'var(--color-elevated)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 8,
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  color: 'var(--color-ink)',
};

export function OverviewTab({ campaignId, campaign }: { campaignId: string; campaign: Campaign }) {
  const { data: perf, isLoading } = useQuery<CampaignPerformance>({
    queryKey: ['campaign-performance', campaignId],
    queryFn: () => campaignsApi.performance(campaignId),
  });

  const pipelineData = LEAD_PIPELINE_STAGES
    .map((stage) => ({
      stage: stage.replace(/_/g, ' '),
      count: perf?.leadsByStatus?.[stage] ?? 0,
      color: PIPELINE_STAGE_COLORS[stage] ?? '#6ba3be',
    }))
    .filter((d) => d.count > 0);

  const messageData = MESSAGE_DELIVERY_STAGES
    .map((stage) => ({
      stage: stage.replace(/_/g, ' '),
      count: perf?.messagesByStatus?.[stage] ?? 0,
      color: MESSAGE_STAGE_COLORS[stage] ?? '#6ba3be',
    }))
    .filter((d) => d.count > 0);

  const replyRate = perf?.metrics.replyRate ?? 0;
  const convRate  = perf?.metrics.conversionRate ?? 0;

  // Suppress unused warning — campaign prop reserved for future use
  void campaign;

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Leads"
          value={isLoading ? '—' : (perf?.metrics.totalLeads ?? 0)}
          icon={Users}
          accent="aqua"
          loading={isLoading}
        />
        <StatCard
          label="Messages Sent"
          value={isLoading ? '—' : (perf?.metrics.messagesSent ?? 0)}
          icon={Send}
          accent="orchid"
          loading={isLoading}
        />
        <StatCard
          label="Reply Rate"
          value={isLoading ? '—' : formatPercent(replyRate)}
          icon={TrendingUp}
          accent="jade"
          loading={isLoading}
        />
        <StatCard
          label="Conversion Rate"
          value={isLoading ? '—' : formatPercent(convRate)}
          icon={BarChart2}
          accent="gold"
          loading={isLoading}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard title="Lead Pipeline" loading={isLoading} empty={pipelineData.length === 0}>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={pipelineData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="stage"
                tick={{ fontSize: 9, fontFamily: 'var(--font-mono)', fill: 'var(--color-dusk)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 9, fontFamily: 'var(--font-mono)', fill: 'var(--color-dusk)' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {pipelineData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Message Status" loading={isLoading} empty={messageData.length === 0}>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={messageData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="stage"
                tick={{ fontSize: 9, fontFamily: 'var(--font-mono)', fill: 'var(--color-dusk)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 9, fontFamily: 'var(--font-mono)', fill: 'var(--color-dusk)' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {messageData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

// ── ChartCard ─────────────────────────────────────────────────────────────────

function ChartCard({
  title,
  loading,
  empty,
  children,
}: {
  title: string;
  loading: boolean;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-ink/[0.06] bg-surface p-4">
      <h3 className="font-display text-[13px] font-600 text-ink mb-4">{title}</h3>
      {loading ? (
        <div className="skeleton h-40 rounded-lg" />
      ) : empty ? (
        <div className="flex h-40 items-center justify-center">
          <p className="font-mono text-[11px] text-dusk">No data yet</p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

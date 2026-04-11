'use client';

import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { analytics } from '@/lib/api-client';
import { SOURCE_COLORS } from '@/constants';

export function AnalyticsDashboard() {
  const dashboardQuery = useQuery({
    queryKey: ['analytics', 'dashboard'],
    queryFn: () => analytics.dashboard(),
  });
  const sourcesQuery = useQuery({
    queryKey: ['analytics', 'sources'],
    queryFn: () => analytics.sources(),
  });
  const trendQuery = useQuery({
    queryKey: ['analytics', 'trend'],
    queryFn: () => analytics.trend(30),
  });

  const isLoading =
    dashboardQuery.isLoading || sourcesQuery.isLoading || trendQuery.isLoading;
  const isError =
    dashboardQuery.isError || sourcesQuery.isError || trendQuery.isError;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-zinc-400">
        Loading analytics...
      </div>
    );
  }

  if (isError || !dashboardQuery.data) {
    return (
      <div className="rounded-lg bg-white p-8 text-center ring-1 ring-zinc-200">
        <p className="text-sm text-zinc-500">Failed to load analytics data</p>
      </div>
    );
  }

  const dash = dashboardQuery.data;
  const sources = sourcesQuery.data ?? [];
  const trend = trendQuery.data ?? [];

  const totalTokens = Object.values(dash.usage).reduce(
    (sum, v) => sum + (typeof v === 'number' ? v : 0),
    0,
  );
  const costPerLead =
    dash.leads.total > 0 ? Math.round(totalTokens / dash.leads.total) : 0;

  const metricCards = [
    {
      label: 'Total Leads',
      value: dash.leads.total.toLocaleString(),
      sub: 'discovered',
    },
    {
      label: 'Reply Rate',
      value: `${(dash.outreach.replyRate * 100).toFixed(1)}%`,
      sub: 'messages replied',
    },
    {
      label: 'Conversion Rate',
      value: `${(dash.outreach.conversionRate * 100).toFixed(1)}%`,
      sub: 'replied → meeting',
    },
    {
      label: 'Cost per Lead',
      value: costPerLead > 0 ? `${costPerLead} tokens` : '—',
      sub: 'avg token cost',
    },
  ];

  const sourceData = sources.map((s) => ({
    name:
      s.source === 'google_maps'
        ? 'Maps'
        : s.source.charAt(0).toUpperCase() + s.source.slice(1),
    value: s.count,
    source: s.source,
  }));

  const lineData = trend.map((row) => ({
    date: row.date.slice(5, 10), // MM-DD
    leads: row.leadsProcessed,
  }));

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metricCards.map((card) => (
          <div key={card.label} className="rounded-lg bg-white p-4 ring-1 ring-zinc-200">
            <p className="text-xs text-zinc-500">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">{card.value}</p>
            <p className="text-xs text-zinc-400">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Line chart — daily discovery */}
        <div className="col-span-2 rounded-lg bg-white p-4 ring-1 ring-zinc-200">
          <p className="mb-4 text-sm font-medium text-zinc-700">Daily Discovery</p>
          {lineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={lineData}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="leads"
                  stroke="#6B7280"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[220px] items-center justify-center text-sm text-zinc-400">
              No data yet
            </div>
          )}
        </div>

        {/* Donut — source breakdown */}
        <div className="rounded-lg bg-white p-4 ring-1 ring-zinc-200">
          <p className="mb-4 text-sm font-medium text-zinc-700">Source Breakdown</p>
          {sourceData.some((d) => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={sourceData}
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {sourceData.map((entry) => (
                    <Cell
                      key={entry.source}
                      fill={SOURCE_COLORS[entry.source] ?? '#6B7280'}
                    />
                  ))}
                </Pie>
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11 }}
                />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[220px] items-center justify-center text-sm text-zinc-400">
              No data yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

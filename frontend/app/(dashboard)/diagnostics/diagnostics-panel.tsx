'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Database, Zap, Activity, CheckCircle, AlertCircle, Cpu,
  Users, Calendar, ShieldCheck, RefreshCw,
} from 'lucide-react';
import { health as healthApi, compliance, organizations } from '@/lib/api-client';
import { indicatorStatus } from '@/models/health';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function DiagnosticsPanel() {
  const healthQuery = useQuery({
    queryKey: ['health', 'full'],
    queryFn: () => healthApi.full(),
    refetchInterval: 30_000,
  });

  const orgStatsQuery = useQuery({
    queryKey: ['org', 'stats'],
    queryFn: () => organizations.stats(),
    refetchInterval: 60_000,
  });

  const retentionQuery = useQuery({
    queryKey: ['compliance', 'retention'],
    queryFn: () => compliance.retentionSummary(),
  });

  const h = healthQuery.data;
  const stats = orgStatsQuery.data;
  const retention = retentionQuery.data;

  // Flatten nested org stats to display values
  const leadsToday        = stats?.leads?.today ?? 0;
  const maxLeadsPerDay    = stats?.organization?.maxLeadsPerDay ?? 50;
  const aiTokensThisMonth = Number(stats?.usage?.aiTokensUsed ?? 0);
  const maxAiTokens       = 1_000_000; // Organisation.maxAiTokensPerMonth (BigInt default)

  function statusClass(s: 'ok' | 'error' | undefined) {
    if (!s) return { dot: 'bg-dusk', text: 'text-dusk', label: '—' };
    if (s === 'ok') return { dot: 'bg-jade', text: 'text-jade', label: 'OK' };
    return { dot: 'bg-crimson', text: 'text-crimson', label: 'ERROR' };
  }

  const overallStatus = h?.status ?? (healthQuery.isError ? 'error' : 'loading');

  // Per-subsystem statuses derived from Terminus `info` / `details`
  const dbStatus     = indicatorStatus(h, 'database');
  const redisStatus  = indicatorStatus(h, 'redis');
  const queueStatus  = indicatorStatus(h, 'queues');
  const apiStatus    = healthQuery.isError ? 'error' as const : h ? 'ok' as const : undefined;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-700 text-ink">Diagnostics</h1>
          <p className="mt-0.5 font-mono text-[11px] text-dusk">System health · resource usage · compliance</p>
        </div>
        <div className={cn(
          'flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[11px]',
          overallStatus === 'ok'       ? 'border-jade/20 bg-jade/5 text-jade' :
          overallStatus === 'degraded' ? 'border-gold/20 bg-gold/5 text-gold' :
          overallStatus === 'loading'  ? 'border-mist/10 text-dusk' :
                                         'border-crimson/20 bg-crimson/5 text-crimson',
        )}>
          <span className={cn(
            'h-1.5 w-1.5 rounded-full',
            overallStatus === 'ok'       ? 'bg-jade' :
            overallStatus === 'degraded' ? 'bg-gold animate-pulse-dot' :
            overallStatus === 'loading'  ? 'bg-dusk' : 'bg-crimson',
          )} />
          {overallStatus === 'loading' ? 'Checking…' :
           overallStatus === 'ok'      ? 'All Systems Operational' :
           overallStatus === 'degraded'? 'Degraded' : 'System Issue'}
        </div>
      </div>

      {/* Health checks grid — reads from Terminus info/details, not top-level fields */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Database', icon: Database,    status: dbStatus },
          { label: 'Redis',    icon: Zap,         status: redisStatus },
          { label: 'Queues',   icon: Activity,    status: queueStatus },
          { label: 'API',      icon: CheckCircle, status: apiStatus },
        ].map(({ label, icon: Icon, status }) => {
          const s = statusClass(status);
          return (
            <div key={label} className="rounded-xl border border-ink/[0.06] bg-surface p-4">
              <div className="flex items-center justify-between mb-2">
                <Icon className="h-4 w-4 text-dusk" />
                {healthQuery.isLoading ? (
                  <div className="skeleton h-3 w-8 rounded" />
                ) : (
                  <span className={cn('flex items-center gap-1 font-mono text-[10px]', s.text)}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
                    {s.label}
                  </span>
                )}
              </div>
              <p className="text-[13px] font-500 text-ink">{label}</p>
            </div>
          );
        })}
      </div>

      {/* Usage + Compliance row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Resource usage — reads nested OrgStats shape */}
        <Card>
          <CardHeader>
            <CardTitle>Resource Usage</CardTitle>
            <RefreshCw className="h-3 w-3 text-dusk" />
          </CardHeader>
          <div className="space-y-3">
            {[
              {
                label: 'Leads Today',
                icon: Users,
                used: leadsToday,
                max: maxLeadsPerDay,
                color: 'bg-aqua',
                textColor: 'text-aqua',
              },
              {
                label: 'AI Tokens (Month)',
                icon: Cpu,
                used: aiTokensThisMonth,
                max: maxAiTokens,
                color: 'bg-orchid',
                textColor: 'text-orchid',
              },
            ].map(({ label, icon: Icon, used, max, color, textColor }) => {
              const pct = max > 0 ? Math.min((used / max) * 100, 100) : 0;
              return (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5 text-dusk" />
                      <span className="text-[12px] text-mist">{label}</span>
                    </div>
                    <span className={cn('num font-mono text-[11px]', textColor)}>
                      {used.toLocaleString()} / {max.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-ink/[0.06]">
                    <div
                      className={cn('h-1.5 rounded-full transition-all', color)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-right font-mono text-[10px] text-dusk">{pct.toFixed(0)}% used</p>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Compliance overview
            Backend returns: { totalLeads, optedOut, expiringSoon, retentionPolicyDays }
            expiringSoon = leads with dataExpiresAt within the next 7 days (not 30).
            No "expired" field exists — removed.
        */}
        <Card>
          <CardHeader>
            <CardTitle>Compliance Overview</CardTitle>
            <ShieldCheck className="h-3.5 w-3.5 text-jade" />
          </CardHeader>
          <div className="space-y-3">
            {[
              {
                label: 'Total Leads',
                value: retention?.totalLeads ?? 0,
                icon: Users,
                color: 'text-aqua',
              },
              {
                label: 'Opted Out',
                value: retention?.optedOut ?? 0,
                icon: ShieldCheck,
                color: 'text-jade',
              },
              {
                label: 'Expiring in 7 days',
                value: retention?.expiringSoon ?? 0,
                icon: Calendar,
                color: 'text-gold',
              },
              {
                label: `Retention Policy`,
                value: retention ? `${retention.retentionPolicyDays}d` : '—',
                icon: AlertCircle,
                color: 'text-mist',
                isText: true,
              },
            ].map(({ label, value, icon: Icon, color, isText }) => (
              <div key={label} className="flex items-center gap-3">
                <Icon className={cn('h-3.5 w-3.5 shrink-0', color)} />
                <span className="flex-1 text-[12px] text-mist">{label}</span>
                <span className={cn('num font-mono text-[12px] font-500', color)}>
                  {isText ? value : (value as number).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Health details (raw Terminus JSON for debugging) */}
      {h?.details && (
        <Card>
          <CardHeader>
            <CardTitle>Health Details</CardTitle>
          </CardHeader>
          <pre className="overflow-x-auto rounded-lg bg-elevated p-3 font-mono text-[11px] text-mist">
            {JSON.stringify(h.details, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  );
}

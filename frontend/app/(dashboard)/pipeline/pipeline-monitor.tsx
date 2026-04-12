'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, AlertCircle, CheckCircle, RefreshCw, Pause, Play,
  Copy, Check, ChevronDown, ChevronRight, RotateCcw,
} from 'lucide-react';
import { analytics, health } from '@/lib/api-client';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { LogEntry, LogLegend } from '@/components/ui/log-entry';
import { cn } from '@/lib/utils';
import type { DiagnosticLog, FailedJob, PipelineStageId } from '@/models';

// ── Mock log generator (frontend-simulated until backend WebSocket) ───────────

function generateMockLogs(count = 40): DiagnosticLog[] {
  const stages: PipelineStageId[] = ['intent', 'enrich', 'score', 'personalize', 'outreach'];
  const msgs = [
    ['INFO',  'intent',      'Classified intent: BUYING (conf: 0.94)'],
    ['INFO',  'enrich',      'ICP attributes extracted: CTO, SaaS, Series A'],
    ['INFO',  'score',       'Lead scored 72/100 — tier HOT'],
    ['INFO',  'personalize', 'Personalization complete: 4 layers applied'],
    ['INFO',  'outreach',    'Message drafted (spam: 0.12, unique: 0.91)'],
    ['WARN',  'intent',      'Low confidence (0.61) — skipping personalization'],
    ['WARN',  'enrich',      'Missing industry field, fallback to unknown'],
    ['ERROR', 'score',       'Scoring error: intent data missing from lead'],
    ['DEBUG', 'outreach',    'Burnt pattern check: 0 matches'],
    ['INFO',  'intent',      'Intent type: COMPARING — added to nurture pool'],
    ['INFO',  'score',       'Lead scored 18/100 — tier WARM'],
    ['WARN',  'outreach',    'Spam score 0.38 — message flagged for review'],
  ] as const;

  const now = Date.now();
  return Array.from({ length: count }, (_, i) => {
    const [level, stage, message] = msgs[i % msgs.length];
    return {
      id: `log-${i}`,
      level: level as DiagnosticLog['level'],
      stage: stage as PipelineStageId,
      message,
      timestamp: new Date(now - (count - i) * 8_000).toISOString(),
      leadId: Math.random() > 0.5 ? Math.random().toString(36).slice(2, 10) : undefined,
    };
  });
}

const INITIAL_LOGS = generateMockLogs(40);

const PIPELINE_STAGES = [
  { id: 'intent' as const,      label: 'Intent Detection',   desc: 'AI classifies buyer intent', color: '#06B6D4', queueName: 'intent' },
  { id: 'enrich' as const,      label: 'ICP Enrichment',     desc: 'Extract ICP attributes',     color: '#7C3AED', queueName: 'enrich' },
  { id: 'score' as const,       label: 'Lead Scoring',       desc: '7-factor deterministic',     color: '#F59E0B', queueName: 'score' },
  { id: 'personalize' as const, label: 'Personalization',    desc: '4-layer personalization',    color: '#F97316', queueName: 'personalize' },
  { id: 'outreach' as const,    label: 'Outreach Generation', desc: 'Message + anti-spam check', color: '#10B981', queueName: 'outreach' },
];

const MOCK_FAILED_JOBS: FailedJob[] = [
  {
    id: 'job-1',
    queueName: 'score',
    jobName: 'score-lead',
    leadId: 'abc12345',
    error: 'TypeError: Cannot read properties of null (reading \'intentConfidence\')',
    failedAt: new Date(Date.now() - 300_000).toISOString(),
    attempts: 3,
  },
  {
    id: 'job-2',
    queueName: 'intent',
    jobName: 'classify-intent',
    leadId: 'def67890',
    error: 'OpenAI API rate limit exceeded. Retry after 60s.',
    failedAt: new Date(Date.now() - 900_000).toISOString(),
    attempts: 2,
  },
];

export function PipelineMonitor() {
  const [logs, setLogs] = useState<DiagnosticLog[]>(INITIAL_LOGS);
  const [logFilter, setLogFilter] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'>('ALL');
  const [stageFilter, setStageFilter] = useState<PipelineStageId | 'all'>('all');
  const [autoscroll, setAutoscroll] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const dashQuery = useQuery({
    queryKey: ['analytics', 'dashboard'],
    queryFn: () => analytics.dashboard(),
    refetchInterval: 15_000,
  });

  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: () => health.full(),
    refetchInterval: 15_000,
  });

  // Simulate new log entries
  useEffect(() => {
    const interval = setInterval(() => {
      const newLog: DiagnosticLog = {
        id: `log-${Date.now()}`,
        level: Math.random() > 0.85 ? (Math.random() > 0.5 ? 'WARN' : 'ERROR') : 'INFO',
        stage: PIPELINE_STAGES[Math.floor(Math.random() * PIPELINE_STAGES.length)].id,
        message: [
          'Processing lead batch…',
          'Intent classified: BUYING (conf: 0.89)',
          'Score computed: 64 — tier WARM',
          'Message draft created',
          'Rate limit check passed',
          'ICP match: 3/5 criteria',
        ][Math.floor(Math.random() * 6)],
        timestamp: new Date().toISOString(),
        leadId: Math.random() > 0.6 ? Math.random().toString(36).slice(2, 10) : undefined,
      };
      setLogs((prev) => [...prev.slice(-199), newLog]);
    }, 6_000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (autoscroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs, autoscroll]);

  const filteredLogs = logs.filter((l) => {
    if (logFilter !== 'ALL' && l.level !== logFilter) return false;
    if (stageFilter !== 'all' && l.stage !== stageFilter) return false;
    return true;
  });

  const byStatus = dashQuery.data?.leads.byStatus ?? {};

  function copyLog(log: DiagnosticLog) {
    const text = `[${log.level}] ${log.timestamp} [${log.stage}] ${log.message}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(log.id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }

  const pipelineHealth =
    MOCK_FAILED_JOBS.length === 0 ? 100 :
    Math.max(0, 100 - MOCK_FAILED_JOBS.length * 15);

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-700 text-ink">Pipeline Monitor</h1>
          <p className="mt-0.5 font-mono text-[11px] text-mist">
            Real-time queue depths · diagnostic logs · failed jobs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-mist">Health</span>
          <div className="flex h-6 w-16 overflow-hidden rounded-full bg-ink/[0.06]">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                pipelineHealth >= 80 ? 'bg-jade' : pipelineHealth >= 50 ? 'bg-gold' : 'bg-crimson',
              )}
              style={{ width: `${pipelineHealth}%` }}
            />
          </div>
          <span className="num font-mono text-[11px] text-mist">{pipelineHealth}%</span>
        </div>
      </div>

      {/* Pipeline flow viz */}
      <Card className="overflow-x-auto">
        <CardHeader>
          <CardTitle>Processing Pipeline</CardTitle>
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-mist">
            <Activity className="h-3 w-3 animate-pulse-dot text-orchid" />
            Live
          </div>
        </CardHeader>

        <div className="flex min-w-max items-stretch gap-0 pt-2">
          {PIPELINE_STAGES.map((stage, idx) => {
            const count = byStatus[stage.id.toUpperCase()] ?? 0;
            const isLast = idx === PIPELINE_STAGES.length - 1;
            return (
              <div key={stage.id} className="flex items-stretch">
                {/* Stage node */}
                <div
                  className="flex w-40 flex-col rounded-xl border p-3 transition-all"
                  style={{
                    borderColor: `${stage.color}20`,
                    background: `${stage.color}06`,
                  }}
                >
                  {/* Stage header */}
                  <div className="mb-2 flex items-center gap-1.5">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{
                        background: stage.color,
                        boxShadow: count > 0 ? `0 0 6px ${stage.color}60` : 'none',
                      }}
                    />
                    <span className="font-mono text-[10px] uppercase tracking-wider text-mist">
                      {stage.id}
                    </span>
                  </div>

                  <p className="text-[12px] font-500 text-ink leading-tight mb-1">
                    {stage.label}
                  </p>
                  <p className="font-mono text-[9px] text-mist leading-relaxed flex-1">
                    {stage.desc}
                  </p>

                  {/* Count */}
                  <div className="mt-2 flex items-end justify-between border-t border-ink/[0.06] pt-2">
                    <span className="num font-mono text-2xl font-700" style={{ color: stage.color }}>
                      {count}
                    </span>
                    <span className="font-mono text-[9px] text-mist">leads</span>
                  </div>
                </div>

                {/* Connector arrow */}
                {!isLast && (
                  <div className="flex items-center px-2">
                    <svg width="28" height="16" viewBox="0 0 28 16" fill="none">
                      <line
                        x1="0" y1="8" x2="20" y2="8"
                        stroke="rgba(255,255,255,0.06)"
                        strokeWidth="1.5"
                        strokeDasharray="4 3"
                        className="animate-flow-dash"
                        style={{ animationDuration: '0.8s' }}
                      />
                      <path
                        d="M18 4L24 8L18 12"
                        stroke="rgba(255,255,255,0.12)"
                        strokeWidth="1.5"
                        fill="none"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Logs + Failed Jobs */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

        {/* Diagnostic logs */}
        <div className="lg:col-span-2">
          <Card className="flex h-[480px] flex-col p-0 overflow-hidden">
            {/* Log header */}
            <div className="flex items-center gap-3 border-b border-ink/[0.06] px-4 py-3">
              <span className="font-display text-[13px] font-600 text-ink">Diagnostic Logs</span>
              <LogLegend />
              <div className="ml-auto flex items-center gap-2">
                {/* Level filter */}
                <select
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value as typeof logFilter)}
                  className="rounded border border-ink/[0.06] bg-elevated px-2 py-1 font-mono text-[10px] text-mist"
                >
                  {['ALL', 'INFO', 'WARN', 'ERROR', 'DEBUG'].map((l) => (
                    <option key={l} value={l} className="bg-overlay">{l}</option>
                  ))}
                </select>
                {/* Stage filter */}
                <select
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value as typeof stageFilter)}
                  className="rounded border border-ink/[0.06] bg-elevated px-2 py-1 font-mono text-[10px] text-mist"
                >
                  <option value="all" className="bg-overlay">All Stages</option>
                  {PIPELINE_STAGES.map((s) => (
                    <option key={s.id} value={s.id} className="bg-overlay">{s.id}</option>
                  ))}
                </select>
                {/* Autoscroll toggle */}
                <button
                  onClick={() => setAutoscroll(!autoscroll)}
                  className={cn(
                    'flex items-center gap-1 rounded px-2 py-1 font-mono text-[10px] transition-colors',
                    autoscroll ? 'bg-aqua/10 text-aqua' : 'text-mist hover:text-ink',
                  )}
                >
                  {autoscroll ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  {autoscroll ? 'Pause' : 'Resume'}
                </button>
              </div>
            </div>

            {/* Log list */}
            <div
              ref={logRef}
              className="flex-1 overflow-y-auto py-1 font-mono"
            >
              {filteredLogs.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="font-mono text-[11px] text-mist">No logs match filter</p>
                </div>
              ) : (
                filteredLogs.map((log) => (
                  <div key={log.id} className="group relative">
                    <LogEntry log={log} compact />
                    <button
                      onClick={() => copyLog(log)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center"
                    >
                      {copiedId === log.id
                        ? <Check className="h-3 w-3 text-jade" />
                        : <Copy className="h-3 w-3 text-mist hover:text-ink" />}
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-ink/[0.06] px-4 py-2">
              <span className="font-mono text-[10px] text-mist">{filteredLogs.length} entries</span>
              <span className={cn('flex items-center gap-1 font-mono text-[10px]', autoscroll ? 'text-jade' : 'text-mist')}>
                <span className={autoscroll ? 'dot-live' : 'dot-idle'} style={{ width: 6, height: 6 }} />
                {autoscroll ? 'Live' : 'Paused'}
              </span>
            </div>
          </Card>
        </div>

        {/* Failed Jobs */}
        <div>
          <Card className="h-[480px] flex flex-col overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-ink/[0.06] px-4 py-3">
              <span className="font-display text-[13px] font-600 text-ink">Failed Jobs</span>
              {MOCK_FAILED_JOBS.length > 0 && (
                <span className="rounded-full bg-crimson/10 px-2 py-0.5 font-mono text-[10px] text-crimson">
                  {MOCK_FAILED_JOBS.length}
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {MOCK_FAILED_JOBS.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2">
                  <CheckCircle className="h-6 w-6 text-jade" />
                  <p className="font-mono text-[11px] text-mist">No failed jobs</p>
                </div>
              ) : (
                MOCK_FAILED_JOBS.map((job) => (
                  <div
                    key={job.id}
                    className="rounded-lg border border-crimson/15 bg-crimson/[0.03] p-3"
                  >
                    <div
                      className="flex cursor-pointer items-start justify-between gap-2"
                      onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <AlertCircle className="h-3 w-3 shrink-0 text-crimson" />
                          <span className="font-mono text-[10px] text-crimson uppercase">{job.queueName}</span>
                          <span className="font-mono text-[9px] text-mist">·</span>
                          <span className="font-mono text-[9px] text-mist">{job.attempts} attempts</span>
                        </div>
                        <p className="font-mono text-[11px] text-mist truncate">{job.jobName}</p>
                        {job.leadId && (
                          <p className="font-mono text-[9px] text-mist">Lead #{job.leadId.slice(0, 8)}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button className="flex items-center gap-1 rounded border border-ink/[0.06] px-2 py-1 font-mono text-[9px] text-mist hover:border-jade/30 hover:text-jade transition-colors">
                          <RotateCcw className="h-2.5 w-2.5" />
                          Retry
                        </button>
                        {expandedJob === job.id
                          ? <ChevronDown className="h-3 w-3 text-mist" />
                          : <ChevronRight className="h-3 w-3 text-mist" />}
                      </div>
                    </div>

                    {expandedJob === job.id && (
                      <div className="mt-2 rounded border border-crimson/10 bg-crimson/[0.04] p-2">
                        <p className="font-mono text-[10px] text-crimson break-all leading-relaxed">
                          {job.error}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-ink/[0.06] px-4 py-2">
              <button className="w-full font-mono text-[10px] text-mist hover:text-ink transition-colors text-center">
                View all failed jobs →
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

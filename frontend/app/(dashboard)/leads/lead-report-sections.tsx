'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leads as leadsApi } from '@/lib/api-client';

interface Props {
  leadId: string;
}

export function LeadReportSections({ leadId }: Props) {
  const queryClient = useQueryClient();
  const [showFullReport, setShowFullReport] = useState(false);
  const [showFullScript, setShowFullScript] = useState(false);

  const { data: reportsData, isLoading: reportsLoading, isError: reportsError } = useQuery({
    queryKey: ['lead-reports', leadId],
    queryFn: () => leadsApi.reports(leadId),
    staleTime: 5 * 60 * 1000,
  });

  const { data: coldCallScript, isLoading: scriptLoading } = useQuery({
    queryKey: ['lead-cold-call', leadId],
    queryFn: () => leadsApi.coldCallScript(leadId),
    staleTime: 5 * 60 * 1000,
  });

  const regenerateMutation = useMutation({
    mutationFn: () => leadsApi.regenerateReport(leadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-reports', leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-cold-call', leadId] });
    },
  });

  if (reportsLoading || scriptLoading) return null;

  if (reportsError) {
    return (
      <div className="col-span-full font-mono text-[10px] text-crimson">
        Reports failed to load
      </div>
    );
  }

  const latest = reportsData?.latest ?? null;

  return (
    <>
      {latest ? (
        <div className="col-span-full rounded-lg border border-jade/20 bg-surface p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <p className="section-label text-jade">AI Deep Report</p>
              <span className="font-mono text-[9px] text-mist">
                v{latest.version} · {new Date(latest.generatedAt).toLocaleDateString()}
              </span>
              <button
                type="button"
                onClick={() => regenerateMutation.mutate()}
                disabled={regenerateMutation.isPending}
                className="font-mono text-[9px] text-jade/60 hover:text-jade hover:underline disabled:opacity-40"
              >
                {regenerateMutation.isPending ? 'regenerating…' : '↺ regenerate'}
              </button>
            </div>
            {latest.metadata.totalRevenueOpportunity?.conservative !== undefined && (
              <span className="font-mono text-[9px] text-mist">
                Est. ${latest.metadata.totalRevenueOpportunity.conservative.toLocaleString()}–
                ${latest.metadata.totalRevenueOpportunity.optimistic.toLocaleString()}/yr
              </span>
            )}
          </div>

          {latest.metadata.painPoints.length > 0 && (
            <div className="space-y-1.5">
              <p className="font-mono text-[9px] uppercase tracking-wider text-mist">Top pain points</p>
              {latest.metadata.painPoints.slice(0, 3).map((pp, i) => (
                <div key={i} className="font-mono text-[10px] text-ink leading-relaxed">
                  <span
                    className={
                      pp.priority === 'high' ? 'text-crimson' :
                      pp.priority === 'medium' ? 'text-gold' : 'text-mist'
                    }
                  >
                    [{pp.priority.toUpperCase()}]
                  </span>{' '}
                  <span className="font-600">{pp.title}</span>
                  <span className="text-mist"> — {pp.evidence}</span>
                </div>
              ))}
            </div>
          )}

          {latest.metadata.topOpportunity && (
            <div className="rounded border border-jade/10 bg-jade/5 px-3 py-2 space-y-0.5">
              <p className="font-mono text-[9px] uppercase tracking-wider text-jade">Top Opportunity</p>
              <p className="font-mono text-[11px] font-600 text-ink">{latest.metadata.topOpportunity.title}</p>
              <p className="font-mono text-[10px] text-mist leading-relaxed">{latest.metadata.topOpportunity.rationale}</p>
              {latest.metadata.topOpportunity.estimatedAnnualValue > 0 && (
                <p className="font-mono text-[10px] text-jade">
                  ~${latest.metadata.topOpportunity.estimatedAnnualValue.toLocaleString()}/yr
                </p>
              )}
            </div>
          )}

          {latest.metadata.emailAngles?.length > 0 && (
            <div className="space-y-1.5">
              <p className="font-mono text-[9px] uppercase tracking-wider text-mist">Email Angles</p>
              {latest.metadata.emailAngles.slice(0, 2).map((angle, i) => (
                <div key={i} className="rounded border border-ink/[0.06] bg-elevated/50 px-3 py-2 space-y-0.5">
                  <p className="font-mono text-[10px] font-600 text-aqua">{angle.hook}</p>
                  <p className="font-mono text-[10px] text-mist">{angle.evidence}</p>
                  <p className="font-mono text-[10px] text-ink">{angle.valueProp}</p>
                  <p className="font-mono text-[9px] text-jade/80 italic">{angle.cta}</p>
                </div>
              ))}
            </div>
          )}

          {latest.metadata.recommendations?.length > 0 && (
            <div className="space-y-1.5">
              <p className="font-mono text-[9px] uppercase tracking-wider text-mist">Recommendations</p>
              {latest.metadata.recommendations.slice(0, 3).map((rec, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={
                    rec.phase === 'immediate' ? 'font-mono text-[9px] text-crimson' :
                    rec.phase === 'short_term' ? 'font-mono text-[9px] text-gold' :
                    'font-mono text-[9px] text-mist'
                  }>
                    {rec.phase.replace('_', ' ').toUpperCase()}
                  </span>
                  <span className="font-mono text-[10px] text-ink">{rec.title}</span>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowFullReport((v) => !v)}
            className="font-mono text-[10px] text-jade hover:underline"
          >
            {showFullReport ? '− Hide full report' : '+ View full report'}
          </button>

          {showFullReport && (
            <pre className="font-mono text-[10px] text-ink whitespace-pre-wrap leading-relaxed bg-elevated p-3 rounded border border-ink/[0.06] max-h-[480px] overflow-y-auto">
              {latest.body}
            </pre>
          )}
        </div>
      ) : (
        <div className="col-span-full rounded-lg border border-ink/[0.06] bg-surface p-4 text-center space-y-2">
          <p className="font-mono text-[11px] text-mist">No AI report generated yet</p>
          <button
            type="button"
            onClick={() => regenerateMutation.mutate()}
            disabled={regenerateMutation.isPending}
            className="font-mono text-[10px] text-jade border border-jade/30 rounded px-3 py-1.5 hover:bg-jade/10 disabled:opacity-40 transition-colors"
          >
            {regenerateMutation.isPending ? 'Generating…' : 'Generate report'}
          </button>
        </div>
      )}

      {coldCallScript && (
        <div className="col-span-full rounded-lg border border-orchid/20 bg-surface p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="section-label text-orchid">Cold Call Script</p>
            <span className="font-mono text-[9px] text-mist">
              {new Date(coldCallScript.createdAt).toLocaleDateString()}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowFullScript((v) => !v)}
            className="font-mono text-[10px] text-orchid hover:underline"
          >
            {showFullScript ? '− Hide script' : '+ View script'}
          </button>

          {showFullScript && (
            <pre className="font-mono text-[10px] text-ink whitespace-pre-wrap leading-relaxed bg-elevated p-3 rounded border border-ink/[0.06] max-h-[480px] overflow-y-auto">
              {coldCallScript.body}
            </pre>
          )}
        </div>
      )}
    </>
  );
}

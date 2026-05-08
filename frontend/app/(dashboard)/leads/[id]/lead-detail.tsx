'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { leads as leadsApi, campaigns as campaignsApi } from '@/lib/api-client';
import type { Lead, ScoringBreakdown } from '@/models';
import { ScoreBreakdown as ScoreBreakdownViz } from '@/components/ui/score-bar';
import { Card } from '@/components/ui/card';
import { relativeTime } from '@/lib/utils';
import { LeadReportSections } from '../lead-report-sections';
import { NAV_SECTIONS, prettyIntent, INTENT_TYPE_LABELS, INTENT_URGENCY_LABELS } from './lead-detail-utils';
import { LeadHeaderCard } from './lead-header-card';
import { LeadContactCard } from './lead-contact-card';
import { LeadGapsCard } from './lead-gaps-card';
import { LeadWebsiteAuditCard } from './lead-website-audit';
import { LeadIntentSection } from './lead-intent-section';
import { LeadGmapsCard } from './lead-gmaps-card';
import { LeadMessagesCard } from './lead-messages-card';

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function LoadingSkeleton() {
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="skeleton h-4 w-32 rounded" />
      <div className="skeleton h-28 rounded-xl" />
      <div className="skeleton h-8 rounded-lg" />
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-36 rounded-xl" />)}
      </div>
    </div>
  );
}

export function LeadDetail({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const fromCampaignId = searchParams.get('campaignId') ?? undefined;

  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => leadsApi.get(id),
    staleTime: 2 * 60 * 1000,
  });

  const { data: campaign } = useQuery({
    queryKey: ['campaign', fromCampaignId],
    queryFn: () => campaignsApi.get(fromCampaignId!),
    enabled: !!fromCampaignId,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading || !lead) return <LoadingSkeleton />;

  const typedLead = lead as Lead & { messages?: any[] };
  const scoreBreakdown: ScoringBreakdown | null = typedLead.scoreBreakdown ?? null;
  const digitalGapFactor = scoreBreakdown?.factors?.find((f) => f.name === 'digital-gap');
  const normalizedPct = scoreBreakdown?.normalizedScore ?? (lead.score ?? 0);

  const prettyIntentType    = prettyIntent(lead.intentType,    INTENT_TYPE_LABELS);
  const prettyIntentUrgency = prettyIntent(lead.intentUrgency, INTENT_URGENCY_LABELS);

  const hasIntent = !!(prettyIntentType || prettyIntentUrgency || lead.intentReasoning ||
    lead.budgetSignal || lead.isBuyer != null || lead.intentConfidence != null);

  const hasPsychographics = !!(
    (lead.painPoints?.length) || (lead.fears?.length) || (lead.desires?.length) ||
    lead.toneProfile || lead.recommendedChannel
  );

  const backHref  = fromCampaignId ? `/campaigns/${fromCampaignId}` : '/leads';
  const backLabel = fromCampaignId ? (campaign?.name ?? 'Campaign') : 'Lead Intelligence';

  return (
    <div className="space-y-6 animate-fade-in">

      <LeadHeaderCard lead={lead} normalizedPct={normalizedPct} backHref={backHref} backLabel={backLabel} />

      {/* Anchor nav */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1">
        {NAV_SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => scrollTo(s.id)}
            className="shrink-0 rounded-full border border-ink/20 bg-elevated px-3.5 py-1.5 font-mono text-[11px] font-600 text-ink shadow-sm hover:border-aqua/50 hover:bg-aqua/10 hover:text-aqua transition-all"
          >
            {s.label}
          </button>
        ))}
      </div>

      <LeadContactCard lead={lead} />

      <LeadGapsCard factor={digitalGapFactor} />

      {scoreBreakdown && (
        <Card id="score" className="space-y-2">
          <ScoreBreakdownViz breakdown={scoreBreakdown} />
          {scoreBreakdown.computedAt && (
            <p className="font-mono text-[10px] text-dusk pt-1">
              Computed {relativeTime(scoreBreakdown.computedAt)}
            </p>
          )}
        </Card>
      )}

      <LeadIntentSection
        lead={lead}
        prettyIntentType={prettyIntentType}
        prettyIntentUrgency={prettyIntentUrgency}
        intentReasoning={lead.intentReasoning ?? null}
        painPoints={lead.painPoints ?? null}
        fears={lead.fears ?? null}
        desires={lead.desires ?? null}
        toneProfile={lead.toneProfile ?? null}
        hasIntent={hasIntent}
        hasPsychographics={hasPsychographics}
      />

      <LeadWebsiteAuditCard lead={lead} />

      <LeadGmapsCard lead={lead} />

      <div id="report">
        <LeadReportSections leadId={id} />
      </div>

      <LeadMessagesCard messages={typedLead.messages ?? []} />

    </div>
  );
}

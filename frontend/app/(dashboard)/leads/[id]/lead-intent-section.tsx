'use client';

import { AlertCircle } from 'lucide-react';
import type { Lead } from '@/models';
import { Card, CardLabel } from '@/components/ui/card';
import { Field, YesNo } from '../lead-table-primitives';

interface IntentProps {
  lead: Lead;
  prettyIntentType: string | null;
  prettyIntentUrgency: string | null;
  intentReasoning: string | null;
}

function IntentSignalsCard({ lead, prettyIntentType, prettyIntentUrgency, intentReasoning }: IntentProps) {
  return (
    <Card id="intent" className="space-y-3">
      <CardLabel>Intent Signals</CardLabel>
      <div className="space-y-3">
        {prettyIntentType && (
          <Field label="Type" value={<span className="text-orchid">{prettyIntentType}</span>} />
        )}
        {prettyIntentUrgency && (
          <Field label="Urgency" value={<span className="text-gold">{prettyIntentUrgency}</span>} />
        )}
        {lead.intentConfidence != null && (
          <div>
            <p className="font-mono text-[9px] uppercase tracking-wider text-mist mb-1">Confidence</p>
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 rounded-full bg-ink/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full bg-orchid transition-all duration-500"
                  style={{ width: `${Math.round((lead.intentConfidence ?? 0) * 100)}%` }}
                />
              </div>
              <span className="font-mono text-[12px] text-ink shrink-0">
                {Math.round((lead.intentConfidence ?? 0) * 100)}%
              </span>
            </div>
          </div>
        )}
        {lead.budgetSignal && (
          <Field label="Budget Signal" value={<span className="text-jade">{lead.budgetSignal}</span>} />
        )}
        {lead.isBuyer != null && (
          <Field label="Is Buyer" value={<YesNo yes={lead.isBuyer ?? false} />} />
        )}
        {intentReasoning && (
          <div>
            <p className="font-mono text-[9px] uppercase tracking-wider text-mist mb-1">Reasoning</p>
            <p className="font-mono text-[12px] text-ink leading-relaxed">{intentReasoning}</p>
          </div>
        )}
      </div>
    </Card>
  );
}

interface PsychoProps {
  lead: Lead;
  painPoints: string[] | null;
  fears: string[] | null;
  desires: string[] | null;
  toneProfile: string | null;
}

function PsychographicsCard({ lead, painPoints, fears, desires, toneProfile }: PsychoProps) {
  return (
    <Card className="space-y-3">
      <CardLabel>Psychographics</CardLabel>
      <div className="space-y-3">
        {painPoints && painPoints.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <AlertCircle className="h-3 w-3 text-crimson" />
              <p className="font-mono text-[9px] uppercase tracking-wider text-crimson">Pain Points</p>
            </div>
            <ul className="space-y-1">
              {painPoints.map((p, i) => (
                <li key={i} className="font-mono text-[12px] text-ink flex items-start gap-1.5">
                  <span className="text-crimson mt-1">·</span>{p}
                </li>
              ))}
            </ul>
          </div>
        )}
        {fears && fears.length > 0 && (
          <div>
            <p className="font-mono text-[9px] uppercase tracking-wider text-gold mb-1.5">Fears</p>
            <ul className="space-y-1">
              {fears.map((f, i) => (
                <li key={i} className="font-mono text-[12px] text-ink flex items-start gap-1.5">
                  <span className="text-gold mt-1">·</span>{f}
                </li>
              ))}
            </ul>
          </div>
        )}
        {desires && desires.length > 0 && (
          <div>
            <p className="font-mono text-[9px] uppercase tracking-wider text-jade mb-1.5">Desires</p>
            <ul className="space-y-1">
              {desires.map((d, i) => (
                <li key={i} className="font-mono text-[12px] text-ink flex items-start gap-1.5">
                  <span className="text-jade mt-1">·</span>{d}
                </li>
              ))}
            </ul>
          </div>
        )}
        {toneProfile && (
          <Field label="Tone Profile" value={<span className="text-aqua">{toneProfile}</span>} />
        )}
        {lead.recommendedChannel && (
          <Field label="Best Channel" value={<span className="text-orchid">{lead.recommendedChannel}</span>} />
        )}
      </div>
    </Card>
  );
}

interface SectionProps extends IntentProps, PsychoProps {
  hasIntent: boolean;
  hasPsychographics: boolean;
}

export function LeadIntentSection(props: SectionProps) {
  const { hasIntent, hasPsychographics } = props;
  if (!hasIntent && !hasPsychographics) return null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {hasIntent && <IntentSignalsCard {...props} />}
      {hasPsychographics && <PsychographicsCard {...props} />}
    </div>
  );
}

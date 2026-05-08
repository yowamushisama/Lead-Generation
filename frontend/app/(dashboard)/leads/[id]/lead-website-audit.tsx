'use client';

import { Zap, CheckCircle2 } from 'lucide-react';
import type { Lead, DeepSignals } from '@/models';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardLabel } from '@/components/ui/card';
import { Field, EnrichmentBadge } from '../lead-table-primitives';

// Missing = pitch opportunity → gold/tangerine highlight
// Present = already handled → muted, de-emphasised

function PitchOpportunityTile({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-gold/40 bg-gold/8 px-3 py-2.5">
      <Zap className="h-3.5 w-3.5 shrink-0 text-gold" />
      <span className="font-mono text-[11px] font-600 text-ink">{label}</span>
    </div>
  );
}

function PresentTile({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-ink/[0.07] bg-transparent px-3 py-2.5 opacity-50">
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-jade" />
      <span className="font-mono text-[11px] text-mist line-through">{label}</span>
    </div>
  );
}

// Key metric tile — missing = opportunity (gold), present = muted
function MetricOpportunityTile({ label, missing, detail }: { label: string; missing: boolean; detail: string }) {
  return (
    <div className={cn(
      'rounded-lg border p-3 text-center',
      missing ? 'border-gold/40 bg-gold/8' : 'border-ink/[0.07] bg-transparent opacity-40',
    )}>
      <p className="font-mono text-[9px] uppercase tracking-wider text-mist mb-2">{label}</p>
      {missing
        ? <Zap className="h-5 w-5 text-gold mx-auto" />
        : <CheckCircle2 className="h-5 w-5 text-jade mx-auto" />}
      <p className={cn('font-mono text-[10px] font-600 mt-1', missing ? 'text-gold' : 'text-mist')}>
        {detail}
      </p>
    </div>
  );
}

function LoadTimeTile({ ms }: { ms: number }) {
  const isSlow = ms > 2000;
  return (
    <div className={cn(
      'rounded-lg border p-3 text-center',
      ms > 3000 ? 'border-gold/40 bg-gold/8'
      : ms > 2000 ? 'border-gold/25 bg-gold/5'
      : 'border-ink/[0.07] bg-transparent opacity-40',
    )}>
      <p className="font-mono text-[9px] uppercase tracking-wider text-mist mb-2">Load Time</p>
      {isSlow
        ? <Zap className="h-5 w-5 text-gold mx-auto" />
        : <CheckCircle2 className="h-5 w-5 text-jade mx-auto" />}
      <p className={cn('font-mono text-[18px] font-700 leading-none mt-1', isSlow ? 'text-gold' : 'text-mist')}>
        {(ms / 1000).toFixed(1)}s
      </p>
      <p className="font-mono text-[9px] text-mist mt-0.5">
        {ms > 3000 ? 'Pitch: speed fix' : ms > 2000 ? 'Could improve' : 'Fast'}
      </p>
    </div>
  );
}

function DeepSignalsBlock({ signals }: { signals: DeepSignals }) {
  const features: { label: string; present: boolean }[] = [
    { label: 'Chatbot',          present: signals.hasChatbot },
    { label: 'Booking Widget',   present: signals.hasBookingWidget },
    { label: 'Live Chat',        present: signals.hasLiveChat },
    { label: 'Estimate Calc',    present: signals.hasEstimateCalculator },
    { label: 'Click-to-Call',    present: signals.hasClickToCall },
    { label: 'Schema Markup',    present: signals.hasSchemaMarkup },
    { label: 'Sticky Header',    present: signals.hasStickyHeader },
    { label: 'Team Page',        present: signals.hasTeamPage },
    { label: 'Blog',             present: signals.hasBlog },
  ];

  if (!signals.detectedCrm?.length)           features.push({ label: 'CRM',            present: false });
  if (!signals.detectedEmailMarketing?.length) features.push({ label: 'Email Marketing', present: false });

  const detectedItems: { label: string; value: string }[] = [];
  if (signals.detectedCrm?.length)            detectedItems.push({ label: 'CRM',            value: signals.detectedCrm.join(', ') });
  if (signals.detectedEmailMarketing?.length) detectedItems.push({ label: 'Email Marketing', value: signals.detectedEmailMarketing.join(', ') });
  if (signals.detectedAnalytics?.length)      detectedItems.push({ label: 'Analytics',       value: signals.detectedAnalytics.join(', ') });

  const missing = features.filter((f) => !f.present);
  const present = features.filter((f) => f.present);

  return (
    <div className="space-y-4">
      {missing.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="font-mono text-[9px] uppercase tracking-wider text-gold">Pitch Opportunities</p>
            <span className="font-mono text-[9px] font-600 text-gold border border-gold/35 rounded-full px-1.5 py-px">
              {missing.length} missing
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {missing.map((f) => <PitchOpportunityTile key={f.label} label={f.label} />)}
          </div>
        </div>
      )}

      {present.length > 0 && (
        <div className="space-y-2">
          <p className="font-mono text-[9px] uppercase tracking-wider text-mist/60">Already in place</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {present.map((f) => <PresentTile key={f.label} label={f.label} />)}
          </div>
        </div>
      )}

      {detectedItems.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {detectedItems.map((item) => (
            <Field key={item.label} label={item.label} value={<span className="text-mist/70">{item.value}</span>} />
          ))}
        </div>
      )}
    </div>
  );
}

export function LeadWebsiteAuditCard({ lead }: { lead: Lead }) {
  if (!lead.websiteAudit && !lead.enrichmentStatus) return null;

  const audit = lead.websiteAudit;

  return (
    <Card id="audit" className="space-y-4">
      <CardHeader>
        <CardLabel>Website Audit</CardLabel>
        {lead.enrichmentStatus && <EnrichmentBadge status={lead.enrichmentStatus} />}
      </CardHeader>

      {audit && (
        <div className="space-y-5">
          {/* Key signals — highlight the bad ones as pitch angles */}
          <div className="grid grid-cols-3 gap-3">
            <MetricOpportunityTile label="CTA"    missing={!audit.ctaPresent}   detail={audit.ctaPresent   ? 'Present' : 'Missing'} />
            <MetricOpportunityTile label="Mobile" missing={!audit.hasViewport}  detail={audit.hasViewport  ? 'Ready'   : 'Missing'} />
            <LoadTimeTile ms={audit.loadMs} />
          </div>

          {audit.deepSignals && <DeepSignalsBlock signals={audit.deepSignals} />}

          {/* Tech stack — reference only */}
          {audit.techStack?.length > 0 && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wider text-mist mb-1.5">Tech Stack</p>
              <div className="flex flex-wrap gap-1">
                {audit.techStack.map((t) => (
                  <span key={t} className="font-mono text-[10px] text-mist/70 border border-ink/10 rounded px-1.5 py-0.5">{t}</span>
                ))}
              </div>
            </div>
          )}

          {(audit.title || audit.metaDescription) && (
            <div className="space-y-2">
              {audit.title && <Field label="Page Title" value={<span className="text-mist/80">{audit.title}</span>} />}
              {audit.metaDescription && (
                <Field label="Meta Description" value={<span className="leading-relaxed text-mist/80">{audit.metaDescription}</span>} />
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

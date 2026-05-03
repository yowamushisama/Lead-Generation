'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Star, Globe, Phone, Mail,
  MapPin, Building2, Clock, ExternalLink,
} from 'lucide-react';
import { leads as leadsApi } from '@/lib/api-client';
import type { Lead, ScoringBreakdown } from '@/models';
import { cn, relativeTime } from '@/lib/utils';
import { TierBadge, SourceBadge } from '@/components/ui/badge';
import { ScoreBar } from '@/components/ui/score-bar';
import { Field, YesNo, EnrichmentBadge, fmtCount } from '../lead-table-primitives';
import { LeadReportSections } from '../lead-report-sections';

export function LeadDetail({ id }: { id: string }) {
  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => leadsApi.get(id),
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading || !lead) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="skeleton h-4 w-32 rounded" />
        <div className="skeleton h-8 w-72 rounded-lg" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-40 rounded-xl" />
          ))}
        </div>
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  const anyLead = lead as any;
  const scoreBreakdown: ScoringBreakdown | null = anyLead.scoreBreakdown ?? null;
  const painPoints: string[] | null = anyLead.painPoints ?? null;
  const fears: string[] | null = anyLead.fears ?? null;
  const desires: string[] | null = anyLead.desires ?? null;
  const intentReasoning: string | null = anyLead.intentReasoning ?? null;
  const toneProfile: string | null = anyLead.toneProfile ?? null;

  const hasGmaps = lead.rating != null || lead.reviewCount != null || lead.businessType ||
    (lead as any).googleTypes?.length || (lead as any).businessHours || (lead as any).socialHandles || (lead as any).lastReviewAt;

  const hasWebsite = lead.websiteAudit || lead.enrichmentStatus;

  const hasPsychographics = (painPoints && painPoints.length > 0) ||
    (fears && fears.length > 0) || (desires && desires.length > 0) ||
    toneProfile || lead.recommendedChannel;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Back nav */}
      <Link
        href="/leads"
        className="inline-flex items-center gap-1.5 font-mono text-[11px] text-mist hover:text-ink transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Lead Intelligence
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-ink/[0.08] bg-surface p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="font-display text-xl font-700 text-ink leading-tight">
              {lead.company ?? lead.name ?? 'Unknown Lead'}
            </h1>
            {lead.company && lead.name && (
              <p className="font-mono text-[12px] text-mist">{lead.name}</p>
            )}
            {lead.role && (
              <p className="font-mono text-[11px] text-dusk">{lead.role}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {lead.tier && <TierBadge tier={lead.tier} />}
            {lead.source && <SourceBadge source={lead.source} />}
            <span className="font-mono text-[10px] text-mist border border-ink/[0.10] rounded px-2 py-0.5">
              {lead.status}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <ScoreBar score={lead.score} tier={lead.tier} size="md" />
          {lead.score != null && (
            <span className="font-mono text-[11px] text-mist">{lead.score}/100</span>
          )}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Contact & company */}
        <div className="rounded-xl border border-ink/[0.08] bg-surface p-4 space-y-3">
          <p className="section-label">Contact & Company</p>
          <div className="space-y-2">
            {lead.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 shrink-0 text-aqua" />
                <a href={`mailto:${lead.email}`} className="font-mono text-[11px] text-aqua hover:underline truncate">
                  {lead.email}
                </a>
              </div>
            )}
            {lead.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 shrink-0 text-mist" />
                <span className="font-mono text-[11px] text-mist">{lead.phone}</span>
              </div>
            )}
            {lead.website && (
              <div className="flex items-center gap-2">
                <Globe className="h-3.5 w-3.5 shrink-0 text-aqua" />
                <a
                  href={lead.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[11px] text-aqua hover:underline flex items-center gap-1 truncate"
                >
                  <span className="truncate">{lead.website.replace(/^https?:\/\//, '')}</span>
                  <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                </a>
              </div>
            )}
            {lead.sourceUrl && lead.source === 'linkedin' && (
              <div className="flex items-center gap-2">
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-aqua" />
                <a
                  href={lead.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[11px] text-aqua hover:underline flex items-center gap-1 truncate"
                >
                  <span className="truncate">LinkedIn profile</span>
                  <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                </a>
              </div>
            )}
            {(lead.location || lead.industry) && (
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-mist" />
                <span className="font-mono text-[11px] text-mist">
                  {[lead.location, lead.industry].filter(Boolean).join(' · ')}
                </span>
              </div>
            )}
            {(lead.companySize || lead.headline) && (
              <div className="flex items-start gap-2">
                <Building2 className="h-3.5 w-3.5 shrink-0 text-mist mt-0.5" />
                <span className="font-mono text-[11px] text-mist leading-relaxed">
                  {[lead.companySize, lead.headline].filter(Boolean).join(' — ')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Scoring breakdown */}
        {scoreBreakdown && (
          <div className="rounded-xl border border-ink/[0.08] bg-surface p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="section-label">Scoring Breakdown</p>
              <span className="font-mono text-[10px] text-mist">
                {scoreBreakdown.normalizedScore ?? scoreBreakdown.totalScore}/100
              </span>
            </div>
            <div className="space-y-2">
              {scoreBreakdown.factors?.map((factor, i) => (
                <div key={i} className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-ink">{factor.name}</span>
                    <span className="font-mono text-[10px] text-mist tabular-nums">
                      {factor.score}/{factor.maxPossible}
                    </span>
                  </div>
                  <div className="h-1 w-full rounded-full bg-ink/[0.06] overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        (factor.score / factor.maxPossible) >= 0.7 ? 'bg-jade' :
                        (factor.score / factor.maxPossible) >= 0.4 ? 'bg-gold' : 'bg-crimson/60',
                      )}
                      style={{ width: `${Math.round((factor.score / factor.maxPossible) * 100)}%` }}
                    />
                  </div>
                  {factor.reasoning && (
                    <p className="font-mono text-[9px] text-dusk leading-relaxed">{factor.reasoning}</p>
                  )}
                </div>
              ))}
            </div>
            {scoreBreakdown.computedAt && (
              <p className="font-mono text-[9px] text-dusk">
                Computed {relativeTime(scoreBreakdown.computedAt)}
              </p>
            )}
          </div>
        )}

        {/* Intent signals */}
        {(lead.intentType || lead.intentUrgency || intentReasoning || lead.budgetSignal || lead.isBuyer != null) && (
          <div className="rounded-xl border border-ink/[0.08] bg-surface p-4 space-y-3">
            <p className="section-label">Intent Signals</p>
            <div className="space-y-2.5">
              {lead.intentType && (
                <Field label="Type" value={<span className="text-orchid">{lead.intentType}</span>} />
              )}
              {lead.intentUrgency && (
                <Field label="Urgency" value={<span className="text-gold">{lead.intentUrgency}</span>} />
              )}
              {lead.intentConfidence != null && (
                <Field label="Confidence" value={<span className="text-mist">{Math.round(lead.intentConfidence * 100)}%</span>} />
              )}
              {lead.budgetSignal && (
                <Field label="Budget" value={lead.budgetSignal} />
              )}
              {lead.isBuyer != null && (
                <Field label="Is Buyer" value={<YesNo yes={lead.isBuyer ?? false} />} />
              )}
              {intentReasoning && (
                <Field
                  label="Reasoning"
                  value={<span className="text-[10px] text-mist leading-relaxed">{intentReasoning}</span>}
                />
              )}
            </div>
          </div>
        )}

        {/* Psychographic signals */}
        {hasPsychographics && (
          <div className="rounded-xl border border-ink/[0.08] bg-surface p-4 space-y-3">
            <p className="section-label">Psychographics</p>
            <div className="space-y-3">
              {painPoints && painPoints.length > 0 && (
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-crimson mb-1">Pain Points</p>
                  <ul className="space-y-0.5">
                    {painPoints.map((p, i) => (
                      <li key={i} className="font-mono text-[10px] text-mist flex items-start gap-1">
                        <span className="text-crimson mt-0.5">·</span>{p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {fears && fears.length > 0 && (
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-gold mb-1">Fears</p>
                  <ul className="space-y-0.5">
                    {fears.map((f, i) => (
                      <li key={i} className="font-mono text-[10px] text-mist flex items-start gap-1">
                        <span className="text-gold mt-0.5">·</span>{f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {desires && desires.length > 0 && (
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-jade mb-1">Desires</p>
                  <ul className="space-y-0.5">
                    {desires.map((d, i) => (
                      <li key={i} className="font-mono text-[10px] text-mist flex items-start gap-1">
                        <span className="text-jade mt-0.5">·</span>{d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {toneProfile && (
                <Field label="Tone Profile" value={<span className="text-aqua">{toneProfile}</span>} />
              )}
              {lead.recommendedChannel && (
                <Field label="Best Channel" value={lead.recommendedChannel} />
              )}
            </div>
          </div>
        )}

        {/* Google Maps & Reviews */}
        {hasGmaps && (
          <div className="rounded-xl border border-ink/[0.08] bg-surface p-4 space-y-3">
            <p className="section-label">Google Maps & Reviews</p>
            <div className="space-y-2.5">
              {(lead.rating != null || lead.reviewCount != null) && (
                <div className="flex items-center gap-3">
                  {lead.rating != null && (
                    <span className="flex items-center gap-1 font-mono text-[14px] text-gold font-600">
                      <Star className="h-4 w-4 fill-gold text-gold" />
                      {lead.rating.toFixed(1)}
                    </span>
                  )}
                  {lead.reviewCount != null && (
                    <span className="font-mono text-[11px] text-mist">
                      {fmtCount(lead.reviewCount)} reviews
                    </span>
                  )}
                </div>
              )}
              {lead.businessType && (
                <Field label="Business Type" value={lead.businessType} />
              )}
              {(lead as any).googleTypes?.length > 0 && (
                <Field label="Categories" value={
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {((lead as any).googleTypes as string[]).map((t) => (
                      <span key={t} className="font-mono text-[9px] text-mist border border-ink/10 rounded px-1.5 py-0.5">{t}</span>
                    ))}
                  </div>
                } />
              )}
              {(lead as any).lastReviewAt && (
                <Field
                  label="Last Review"
                  value={<span className="text-mist">{relativeTime((lead as any).lastReviewAt)}</span>}
                />
              )}
              {(lead as any).businessHours && Object.keys((lead as any).businessHours).length > 0 && (
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-mist mb-1.5">
                    <Clock className="h-3 w-3 inline mr-1" />Hours
                  </p>
                  <div className="space-y-0.5">
                    {Object.entries((lead as any).businessHours as Record<string, string>).map(([day, hours]) => (
                      <div key={day} className="flex gap-2">
                        <span className="font-mono text-[9px] text-dusk w-8 shrink-0">{day.slice(0, 3)}</span>
                        <span className="font-mono text-[9px] text-mist">{hours}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(lead as any).socialHandles && (
                ((lead as any).socialHandles.instagram || (lead as any).socialHandles.facebook || (lead as any).socialHandles.tiktok) && (
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-wider text-mist mb-1.5">Socials</p>
                    <div className="flex gap-2">
                      {(lead as any).socialHandles.instagram && (
                        <a href={(lead as any).socialHandles.instagram} target="_blank" rel="noopener noreferrer"
                          className="font-mono text-[9px] text-orchid border border-orchid/30 rounded px-2 py-1 hover:bg-orchid/10 transition-colors">
                          Instagram
                        </a>
                      )}
                      {(lead as any).socialHandles.facebook && (
                        <a href={(lead as any).socialHandles.facebook} target="_blank" rel="noopener noreferrer"
                          className="font-mono text-[9px] text-aqua border border-aqua/30 rounded px-2 py-1 hover:bg-aqua/10 transition-colors">
                          Facebook
                        </a>
                      )}
                      {(lead as any).socialHandles.tiktok && (
                        <a href={(lead as any).socialHandles.tiktok} target="_blank" rel="noopener noreferrer"
                          className="font-mono text-[9px] text-mist border border-ink/20 rounded px-2 py-1 hover:bg-ink/10 transition-colors">
                          TikTok
                        </a>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* Website audit */}
        {hasWebsite && (
          <div className="rounded-xl border border-ink/[0.08] bg-surface p-4 space-y-3">
            <div className="flex items-center gap-2">
              <p className="section-label">Website Audit</p>
              {lead.enrichmentStatus && <EnrichmentBadge status={lead.enrichmentStatus} />}
            </div>
            {lead.websiteAudit && (
              <div className="space-y-2.5">
                {lead.websiteAudit.techStack?.length > 0 && (
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-wider text-mist mb-1.5">Tech Stack</p>
                    <div className="flex flex-wrap gap-1">
                      {lead.websiteAudit.techStack.map((t) => (
                        <span key={t} className="font-mono text-[9px] text-jade border border-jade/20 rounded px-1.5 py-0.5">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-4">
                  <Field label="CTA" value={<YesNo yes={lead.websiteAudit.ctaPresent} />} />
                  <Field label="Mobile" value={<YesNo yes={lead.websiteAudit.hasViewport} />} />
                  <Field label="Load" value={<span className="text-mist">{(lead.websiteAudit.loadMs / 1000).toFixed(1)}s</span>} />
                </div>
                {lead.websiteAudit.title && (
                  <Field label="Title" value={<span className="text-[10px]">{lead.websiteAudit.title}</span>} />
                )}
                {lead.websiteAudit.metaDescription && (
                  <Field
                    label="Meta Desc."
                    value={<span className="text-[10px] leading-relaxed">{lead.websiteAudit.metaDescription}</span>}
                  />
                )}
                {(lead.websiteAudit as any).deepSignals && (
                  <DeepSignalsBlock signals={(lead.websiteAudit as any).deepSignals} />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Report + Cold Call Script */}
      <div className="grid grid-cols-1 gap-4">
        <LeadReportSections leadId={id} />
      </div>

      {/* Recent messages */}
      {(lead as any).messages?.length > 0 && (
        <div className="rounded-xl border border-ink/[0.08] bg-surface p-4 space-y-3">
          <p className="section-label">Outreach Messages</p>
          <div className="space-y-3">
            {((lead as any).messages as any[]).map((msg: any) => (
              <div key={msg.id} className="rounded-lg border border-ink/[0.06] bg-elevated/40 p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-mist uppercase tracking-wider">{msg.channel}</span>
                    {msg.subject && (
                      <span className="font-mono text-[10px] font-600 text-ink truncate">{msg.subject}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn(
                      'font-mono text-[9px] uppercase tracking-wider border rounded px-1.5 py-0.5',
                      msg.status === 'SENT' || msg.status === 'DELIVERED' ? 'text-jade border-jade/30 bg-jade/5' :
                      msg.status === 'REPLIED' ? 'text-aqua border-aqua/30 bg-aqua/5' :
                      msg.status === 'DRAFT' || msg.status === 'PENDING_APPROVAL' ? 'text-gold border-gold/30 bg-gold/5' :
                      'text-mist border-ink/20',
                    )}>
                      {msg.status}
                    </span>
                    <span className="font-mono text-[9px] text-dusk">{relativeTime(msg.createdAt)}</span>
                  </div>
                </div>
                <p className="font-mono text-[10px] text-mist leading-relaxed line-clamp-2">{msg.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

function DeepSignalsBlock({ signals }: { signals: Record<string, unknown> }) {
  const items: { label: string; value: ReactNode }[] = [];

  if (signals.hasChatbot != null) items.push({ label: 'Chatbot', value: <YesNo yes={!!signals.hasChatbot} /> });
  if (signals.hasBookingWidget != null) items.push({ label: 'Booking Widget', value: <YesNo yes={!!signals.hasBookingWidget} /> });
  if (signals.hasLiveChat != null) items.push({ label: 'Live Chat', value: <YesNo yes={!!signals.hasLiveChat} /> });
  if (signals.hasEstimateCalculator != null) items.push({ label: 'Estimate Calc', value: <YesNo yes={!!signals.hasEstimateCalculator} /> });
  if (signals.hasClickToCall != null) items.push({ label: 'Click-to-Call', value: <YesNo yes={!!signals.hasClickToCall} /> });
  if (signals.detectedCrm && (signals.detectedCrm as string[]).length > 0) {
    items.push({ label: 'CRM', value: (signals.detectedCrm as string[]).join(', ') });
  }
  if (signals.gapCount != null && Number(signals.gapCount) > 0) {
    items.push({ label: 'Digital Gaps', value: <span className="text-crimson">{String(signals.gapCount)}</span> });
  }

  if (items.length === 0) return null;

  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-wider text-mist mb-1.5">Deep Signals</p>
      <div className="grid grid-cols-2 gap-1.5">
        {items.map((item) => (
          <Field key={item.label} label={item.label} value={item.value} />
        ))}
      </div>
    </div>
  );
}

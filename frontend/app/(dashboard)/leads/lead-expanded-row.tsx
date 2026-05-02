'use client';

import { Star } from 'lucide-react';
import type { Lead } from '@/models';
import { ScoreBreakdown } from '@/components/ui/score-bar';
import { cn, relativeTime } from '@/lib/utils';
import { EnrichmentBadge, Field, YesNo, fmtCount } from './lead-table-primitives';

export function LeadExpandedRow({ lead, colSpan }: { lead: Lead; colSpan: number }) {
  const hasGmaps = lead.rating != null || lead.reviewCount != null || lead.businessType ||
    lead.googleTypes?.length || lead.businessHours || lead.socialHandles || lead.lastReviewAt;
  const hasWebsite = lead.websiteAudit || lead.enrichmentStatus;

  return (
    <tr className="bg-elevated/50">
      <td colSpan={colSpan} className="px-6 py-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

          {lead.scoreBreakdown && (
            <div className="rounded-lg border border-ink/[0.06] bg-surface p-3">
              <ScoreBreakdown breakdown={lead.scoreBreakdown} />
            </div>
          )}

          <div className="rounded-lg border border-ink/[0.06] bg-surface p-3 space-y-2.5">
            <p className="section-label">Intent Signals</p>
            {lead.intentType    && <Field label="Type"      value={<span className="text-orchid">{lead.intentType}</span>} />}
            {lead.intentUrgency && <Field label="Urgency"   value={<span className="text-gold">{lead.intentUrgency}</span>} />}
            {lead.budgetSignal  && <Field label="Budget"    value={lead.budgetSignal} />}
            {lead.intentReasoning && (
              <Field label="Reasoning" value={<span className="text-[10px] text-mist leading-relaxed">{lead.intentReasoning}</span>} />
            )}
          </div>

          <div className="rounded-lg border border-ink/[0.06] bg-surface p-3 space-y-2.5">
            <p className="section-label">Psychographic Signals</p>
            {lead.painPoints && lead.painPoints.length > 0 && (
              <div>
                <p className="font-mono text-[9px] uppercase tracking-wider text-crimson mb-1">Pain Points</p>
                <ul className="space-y-0.5">
                  {lead.painPoints.map((p, i) => (
                    <li key={i} className="font-mono text-[10px] text-mist flex items-start gap-1">
                      <span className="text-crimson mt-0.5">·</span>{p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {lead.desires && lead.desires.length > 0 && (
              <div>
                <p className="font-mono text-[9px] uppercase tracking-wider text-jade mb-1">Desires</p>
                <ul className="space-y-0.5">
                  {lead.desires.map((d, i) => (
                    <li key={i} className="font-mono text-[10px] text-mist flex items-start gap-1">
                      <span className="text-jade mt-0.5">·</span>{d}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {lead.toneProfile        && <Field label="Tone Profile" value={<span className="text-aqua">{lead.toneProfile}</span>} />}
            {lead.recommendedChannel && <Field label="Channel"      value={lead.recommendedChannel} />}
          </div>

          {(hasGmaps || hasWebsite) && (
            <div className="rounded-lg border border-ink/[0.06] bg-surface p-3 space-y-3">
              {hasGmaps && (
                <div className="space-y-2">
                  <p className="section-label">Google Maps</p>

                  {(lead.rating != null || lead.reviewCount != null) && (
                    <div className="flex items-center gap-2">
                      {lead.rating != null && (
                        <span className="flex items-center gap-1 font-mono text-[12px] text-gold font-600">
                          <Star className="h-3.5 w-3.5 fill-gold text-gold" />
                          {lead.rating.toFixed(1)}
                        </span>
                      )}
                      {lead.reviewCount != null && (
                        <span className="font-mono text-[10px] text-mist">({fmtCount(lead.reviewCount)} reviews)</span>
                      )}
                    </div>
                  )}

                  {lead.businessType && <Field label="Type" value={lead.businessType} />}

                  {lead.googleTypes && lead.googleTypes.length > 0 && (
                    <Field label="Categories" value={
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {lead.googleTypes.slice(0, 4).map((t) => (
                          <span key={t} className="font-mono text-[9px] text-mist border border-ink/10 rounded px-1.5 py-0.5">{t}</span>
                        ))}
                      </div>
                    } />
                  )}

                  {lead.lastReviewAt && (
                    <Field label="Last Review" value={<span className="text-mist">{relativeTime(lead.lastReviewAt)}</span>} />
                  )}

                  {lead.businessHours && Object.keys(lead.businessHours).length > 0 && (
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-wider text-mist mb-1">Hours</p>
                      <div className="space-y-0.5">
                        {Object.entries(lead.businessHours).slice(0, 5).map(([day, hours]) => (
                          <div key={day} className="flex gap-2">
                            <span className="font-mono text-[9px] text-dusk w-8 shrink-0">{day.slice(0, 3)}</span>
                            <span className="font-mono text-[9px] text-mist">{hours}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {lead.socialHandles && (lead.socialHandles.instagram || lead.socialHandles.facebook || lead.socialHandles.tiktok) && (
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-wider text-mist mb-1">Socials</p>
                      <div className="flex gap-2">
                        {lead.socialHandles.instagram && (
                          <a href={lead.socialHandles.instagram} target="_blank" rel="noopener noreferrer"
                            className="font-mono text-[9px] text-orchid border border-orchid/30 rounded px-1.5 py-0.5 hover:bg-orchid/10">Instagram</a>
                        )}
                        {lead.socialHandles.facebook && (
                          <a href={lead.socialHandles.facebook} target="_blank" rel="noopener noreferrer"
                            className="font-mono text-[9px] text-aqua border border-aqua/30 rounded px-1.5 py-0.5 hover:bg-aqua/10">Facebook</a>
                        )}
                        {lead.socialHandles.tiktok && (
                          <a href={lead.socialHandles.tiktok} target="_blank" rel="noopener noreferrer"
                            className="font-mono text-[9px] text-mist border border-ink/20 rounded px-1.5 py-0.5 hover:bg-ink/10">TikTok</a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {hasWebsite && (
                <div className={cn('space-y-2', hasGmaps && 'border-t border-ink/[0.06] pt-3')}>
                  <div className="flex items-center gap-2">
                    <p className="section-label">Website Audit</p>
                    {lead.enrichmentStatus && <EnrichmentBadge status={lead.enrichmentStatus} />}
                  </div>

                  {lead.websiteAudit && (
                    <>
                      {lead.websiteAudit.techStack.length > 0 && (
                        <div>
                          <p className="font-mono text-[9px] uppercase tracking-wider text-mist mb-1">Tech Stack</p>
                          <div className="flex flex-wrap gap-1">
                            {lead.websiteAudit.techStack.map((t) => (
                              <span key={t} className="font-mono text-[9px] text-jade border border-jade/20 rounded px-1.5 py-0.5">{t}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex gap-3">
                        <Field label="CTA"    value={<YesNo yes={lead.websiteAudit.ctaPresent} />} />
                        <Field label="Mobile" value={<YesNo yes={lead.websiteAudit.hasViewport} />} />
                        <Field label="Load"   value={<span className="text-mist">{(lead.websiteAudit.loadMs / 1000).toFixed(1)}s</span>} />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

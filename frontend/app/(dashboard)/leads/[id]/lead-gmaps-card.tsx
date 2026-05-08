'use client';

import { Star, Clock } from 'lucide-react';
import type { Lead } from '@/models';
import { relativeTime } from '@/lib/utils';
import { Card, CardLabel } from '@/components/ui/card';
import { Field, fmtCount } from '../lead-table-primitives';

export function LeadGmapsCard({ lead }: { lead: Lead }) {
  const hasContent = lead.rating != null || lead.reviewCount != null || lead.businessType ||
    lead.googleTypes?.length || lead.businessHours || lead.socialHandles || lead.lastReviewAt;

  if (!hasContent) return null;

  return (
    <Card id="reviews" className="space-y-4">
      <CardLabel>Google Maps & Reviews</CardLabel>

      {(lead.rating != null || lead.reviewCount != null) && (
        <div className="flex items-center gap-4 p-3 rounded-lg bg-gold/5 border border-gold/15">
          {lead.rating != null && (
            <span className="flex items-center gap-1.5 font-mono text-[22px] text-gold font-700">
              <Star className="h-5 w-5 fill-gold text-gold" />
              {lead.rating.toFixed(1)}
            </span>
          )}
          {lead.reviewCount != null && (
            <div>
              <p className="font-mono text-[14px] text-ink font-600">{fmtCount(lead.reviewCount)}</p>
              <p className="font-mono text-[10px] text-mist">reviews</p>
            </div>
          )}
          {lead.lastReviewAt && (
            <div className="ml-auto">
              <p className="font-mono text-[9px] uppercase tracking-wider text-mist">Last review</p>
              <p className="font-mono text-[12px] text-ink">{relativeTime(lead.lastReviewAt)}</p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {lead.businessType && <Field label="Business Type" value={lead.businessType} />}
        {lead.googleTypes && lead.googleTypes.length > 0 && (
          <div>
            <p className="font-mono text-[9px] uppercase tracking-wider text-mist mb-1.5">Categories</p>
            <div className="flex flex-wrap gap-1">
              {lead.googleTypes.map((t) => (
                <span key={t} className="font-mono text-[10px] text-mist border border-ink/10 rounded px-1.5 py-0.5">{t}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {lead.businessHours && Object.keys(lead.businessHours).length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Clock className="h-3 w-3 text-mist" />
            <p className="font-mono text-[9px] uppercase tracking-wider text-mist">Business Hours</p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
            {Object.entries(lead.businessHours).map(([day, hours]) => (
              <div key={day} className="flex gap-3">
                <span className="font-mono text-[11px] text-mist w-8 shrink-0">{day.slice(0, 3)}</span>
                <span className="font-mono text-[11px] text-ink">{hours}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {lead.socialHandles && (lead.socialHandles.instagram || lead.socialHandles.facebook || lead.socialHandles.tiktok) && (
        <div>
          <p className="font-mono text-[9px] uppercase tracking-wider text-mist mb-2">Socials</p>
          <div className="flex gap-2">
            {lead.socialHandles.instagram && (
              <a href={lead.socialHandles.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram"
                className="font-mono text-[11px] text-orchid border border-orchid/30 rounded px-2 py-1 hover:bg-orchid/10 transition-colors">
                Instagram
              </a>
            )}
            {lead.socialHandles.facebook && (
              <a href={lead.socialHandles.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook"
                className="font-mono text-[11px] text-aqua border border-aqua/30 rounded px-2 py-1 hover:bg-aqua/10 transition-colors">
                Facebook
              </a>
            )}
            {lead.socialHandles.tiktok && (
              <a href={lead.socialHandles.tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok"
                className="font-mono text-[11px] text-mist border border-ink/20 rounded px-2 py-1 hover:bg-ink/10 transition-colors">
                TikTok
              </a>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

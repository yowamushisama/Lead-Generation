'use client';

import Link from 'next/link';
import { ArrowLeft, Mail, Phone, Globe } from 'lucide-react';
import type { Lead } from '@/models';
import { TierBadge, SourceBadge } from '@/components/ui/badge';
import { ScoreBar } from '@/components/ui/score-bar';
import { Card } from '@/components/ui/card';

interface Props {
  lead: Lead;
  normalizedPct: number;
  backHref: string;
  backLabel: string;
}

export function LeadHeaderCard({ lead, normalizedPct, backHref, backLabel }: Props) {
  return (
    <>
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 font-mono text-[11px] text-mist hover:text-ink transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {backLabel}
      </Link>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <h1 className="font-display text-xl font-700 text-ink leading-tight">
              {lead.company ?? lead.name ?? 'Unknown Lead'}
            </h1>
            {lead.company && lead.name && (
              <p className="font-mono text-[12px] text-mist">{lead.name}</p>
            )}
            {lead.role && (
              <p className="font-mono text-[11px] text-mist">{lead.role}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {lead.tier && <TierBadge tier={lead.tier} />}
            {lead.source && <SourceBadge source={lead.source} />}
            <span className="font-mono text-[10px] text-mist border border-ink/[0.10] rounded px-2 py-0.5">
              {lead.status}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <ScoreBar score={normalizedPct} tier={lead.tier} size="md" />
          <div>
            <span className="font-mono text-[15px] font-700 text-ink">{normalizedPct.toFixed(0)}%</span>
            {lead.tier && lead.score != null && (
              <span className="ml-2 font-mono text-[11px] text-mist">
                {lead.tier} · {lead.score} pts
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2 pt-1 border-t border-ink/[0.06]">
          {lead.email && (
            <a
              href={`mailto:${lead.email}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-aqua/10 px-3 py-1.5 font-mono text-[11px] text-aqua ring-1 ring-aqua/20 hover:bg-aqua/15 transition-colors"
            >
              <Mail className="h-3 w-3" /> Email
            </a>
          )}
          {lead.phone && (
            <a
              href={`tel:${lead.phone}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-jade/10 px-3 py-1.5 font-mono text-[11px] text-jade ring-1 ring-jade/20 hover:bg-jade/15 transition-colors"
            >
              <Phone className="h-3 w-3" /> Call
            </a>
          )}
          {lead.website && (
            <a
              href={lead.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-ink/[0.06] px-3 py-1.5 font-mono text-[11px] text-mist ring-1 ring-ink/10 hover:bg-ink/[0.10] transition-colors"
            >
              <Globe className="h-3 w-3" /> Website
            </a>
          )}
        </div>
      </Card>
    </>
  );
}

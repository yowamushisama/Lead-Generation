'use client';

import { ChevronDown, ChevronRight, ExternalLink, Star } from 'lucide-react';
import type { Lead, LeadStatus } from '@/models';
import { type ColDef, type ColId } from '@/constants/lead-columns';
import { ALL_STATUSES } from '@/constants/leads';
import { TierBadge, SourceBadge } from '@/components/ui/badge';
import { ScoreBar } from '@/components/ui/score-bar';
import { cn, relativeTime } from '@/lib/utils';
import { EnrichmentBadge, fmtCount } from './lead-table-primitives';
import { LeadExpandedRow } from './lead-expanded-row';

export function LeadRowGroup({
  lead, selected, expanded, activeCols, totalColCount, onSelect, onExpand, onStatusChange,
}: {
  lead: Lead;
  selected: boolean;
  expanded: boolean;
  activeCols: ColDef[];
  totalColCount: number;
  onSelect: () => void;
  onExpand: () => void;
  onStatusChange: (s: LeadStatus) => void;
}) {
  return (
    <>
      <LeadRow
        lead={lead}
        selected={selected}
        expanded={expanded}
        activeCols={activeCols}
        onSelect={onSelect}
        onExpand={onExpand}
        onStatusChange={onStatusChange}
      />
      {expanded && <LeadExpandedRow lead={lead} colSpan={totalColCount} />}
    </>
  );
}

function LeadRow({
  lead, selected, expanded, activeCols, onSelect, onExpand, onStatusChange,
}: {
  lead: Lead;
  selected: boolean;
  expanded: boolean;
  activeCols: ColDef[];
  onSelect: () => void;
  onExpand: () => void;
  onStatusChange: (s: LeadStatus) => void;
}) {
  const tierBorderClass =
    lead.tier === 'HOT'  ? 'row-hot'  :
    lead.tier === 'WARM' ? 'row-warm' :
    lead.tier === 'COLD' ? 'row-cold' : '';

  return (
    <tr
      className={cn(
        'group border-b border-ink/[0.04] transition-colors hover:bg-ink/[0.03]',
        selected && 'bg-aqua/[0.03]',
        tierBorderClass,
      )}
    >
      <td className="px-3 py-2.5">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          className="rounded border-ink/20 bg-surface"
          onClick={(e) => e.stopPropagation()}
        />
      </td>

      <td className="px-3 py-2.5">
        <button className="flex w-full items-center gap-1.5 text-left" onClick={onExpand}>
          {expanded
            ? <ChevronDown className="h-3 w-3 shrink-0 text-aqua" />
            : <ChevronRight className="h-3 w-3 shrink-0 text-dusk group-hover:text-mist" />}
          <div className="min-w-0">
            <p className="truncate text-[12px] font-500 text-ink">{lead.company ?? lead.name ?? '—'}</p>
            {lead.name && lead.company && (
              <p className="truncate font-mono text-[10px] text-mist">{lead.name}</p>
            )}
          </div>
        </button>
      </td>

      <td className="px-3 py-2.5">
        <ScoreBar score={lead.score} tier={lead.tier} size="sm" />
      </td>

      <td className="px-3 py-2.5">
        {lead.tier ? <TierBadge tier={lead.tier} /> : <span className="text-dusk">—</span>}
      </td>

      <td className="px-3 py-2.5">
        <select
          value={lead.status}
          onChange={(e) => onStatusChange(e.target.value as LeadStatus)}
          onClick={(e) => e.stopPropagation()}
          className="rounded border-0 bg-transparent font-mono text-[10px] text-mist focus:outline-none focus:ring-0 cursor-pointer"
        >
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s} className="bg-overlay text-ink">{s}</option>
          ))}
        </select>
      </td>

      {activeCols.map((col) => (
        <td key={col.id} className="px-3 py-2.5">
          <OptionalCell lead={lead} colId={col.id} />
        </td>
      ))}
    </tr>
  );
}

function OptionalCell({ lead, colId }: { lead: Lead; colId: ColId }) {
  switch (colId) {
    case 'role':
      return <span className="truncate font-mono text-[11px] text-mist block">{lead.role ?? '—'}</span>;

    case 'source':
      return <SourceBadge source={lead.source} />;

    case 'intent':
      return lead.intentType
        ? <span className="font-mono text-[10px] text-orchid">{lead.intentType}</span>
        : <span className="text-dusk">—</span>;

    case 'created':
      return <span className="num font-mono text-[10px] text-mist">{relativeTime(lead.createdAt)}</span>;

    case 'location':
      return <span className="truncate font-mono text-[10px] text-mist block">{lead.location ?? '—'}</span>;

    case 'industry':
      return <span className="truncate font-mono text-[10px] text-mist block">{lead.industry ?? '—'}</span>;

    case 'email':
      return lead.email
        ? <span className="truncate font-mono text-[10px] text-aqua block">{lead.email}</span>
        : <span className="text-dusk">—</span>;

    case 'phone':
      return <span className="truncate font-mono text-[10px] text-mist block">{lead.phone ?? '—'}</span>;

    case 'website':
      return lead.website
        ? (
          <a
            href={lead.website}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 font-mono text-[10px] text-aqua hover:underline truncate"
          >
            <span className="truncate">{lead.website.replace(/^https?:\/\//, '')}</span>
            <ExternalLink className="h-2.5 w-2.5 shrink-0" />
          </a>
        )
        : <span className="text-dusk">—</span>;

    case 'rating':
      return lead.rating != null
        ? (
          <span className="flex items-center gap-1 font-mono text-[11px] text-gold">
            <Star className="h-3 w-3 fill-gold text-gold" />
            {lead.rating.toFixed(1)}
          </span>
        )
        : <span className="text-dusk">—</span>;

    case 'reviews':
      return lead.reviewCount != null
        ? <span className="num font-mono text-[11px] text-mist">{fmtCount(lead.reviewCount)}</span>
        : <span className="text-dusk">—</span>;

    case 'businessType':
      return <span className="truncate font-mono text-[10px] text-mist block">{lead.businessType ?? '—'}</span>;

    case 'enrichmentStatus':
      return lead.enrichmentStatus
        ? <EnrichmentBadge status={lead.enrichmentStatus} />
        : <span className="text-dusk">—</span>;

    case 'socialHandles': {
      const s = lead.socialHandles;
      if (!s || (!s.instagram && !s.facebook && !s.tiktok)) return <span className="text-dusk">—</span>;
      return (
        <div className="flex items-center gap-1.5">
          {s.instagram && (
            <a href={s.instagram} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
              className="font-mono text-[9px] uppercase tracking-wider text-orchid border border-orchid/30 rounded px-1 py-0.5 hover:bg-orchid/10">IG</a>
          )}
          {s.facebook && (
            <a href={s.facebook} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
              className="font-mono text-[9px] uppercase tracking-wider text-aqua border border-aqua/30 rounded px-1 py-0.5 hover:bg-aqua/10">FB</a>
          )}
          {s.tiktok && (
            <a href={s.tiktok} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
              className="font-mono text-[9px] uppercase tracking-wider text-mist border border-ink/20 rounded px-1 py-0.5 hover:bg-ink/10">TT</a>
          )}
        </div>
      );
    }

    default:
      return <span className="text-dusk">—</span>;
  }
}

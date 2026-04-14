'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { leads as leadsApi } from '@/lib/api-client';
import type { Lead } from '@/models';
import { TierBadge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { EmptyState } from './shared';

const TIER_FILTERS = ['all', 'HOT', 'WARM', 'COLD'] as const;
type TierFilter = typeof TIER_FILTERS[number];

export function LeadsTab({ campaignId }: { campaignId: string }) {
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['leads', { campaignId, tier: tierFilter }],
    queryFn: () =>
      leadsApi.list({
        campaignId,
        tier: tierFilter !== 'all' ? tierFilter : undefined,
        limit: 50,
      }),
  });

  const leadList = data?.data ?? [];

  return (
    <div className="space-y-4">
      {/* Filter row */}
      <div className="flex items-center gap-2">
        {TIER_FILTERS.map((t) => (
          <button
            key={t}
            onClick={() => setTierFilter(t)}
            className={cn(
              'rounded-lg border px-3 py-1 font-mono text-[11px] transition-colors',
              tierFilter === t
                ? 'border-aqua/30 bg-aqua/10 text-aqua'
                : 'border-ink/[0.06] text-dusk hover:text-mist',
            )}
          >
            {t === 'all' ? 'All Tiers' : t}
          </button>
        ))}
        <span className="ml-auto font-mono text-[11px] text-dusk">{leadList.length} leads</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-14 rounded-lg" />)}
        </div>
      ) : leadList.length === 0 ? (
        <EmptyState icon={Users} label="No leads found" sub="Leads will appear here once the campaign is active" />
      ) : (
        <div className="space-y-2">
          {leadList.map((lead) => <LeadRow key={lead.id} lead={lead} />)}
        </div>
      )}
    </div>
  );
}

// ── LeadRow ───────────────────────────────────────────────────────────────────

function LeadRow({ lead }: { lead: Lead }) {
  const detail = [lead.role, lead.company].filter(Boolean).join(' · ') || '—';

  return (
    <div className="flex items-center gap-3 rounded-lg border border-ink/[0.06] bg-surface px-4 py-2.5 hover:bg-elevated transition-colors">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[12px] font-500 text-ink truncate">{lead.name ?? '—'}</p>
        <p className="font-mono text-[10px] text-dusk truncate">{detail}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {lead.tier && <TierBadge tier={lead.tier} />}
        <span className="font-mono text-[10px] text-dusk hidden sm:block">
          {lead.status.replace(/_/g, ' ')}
        </span>
        {lead.score != null && (
          <span className="num font-mono text-[10px] text-aqua">{lead.score}</span>
        )}
      </div>
    </div>
  );
}

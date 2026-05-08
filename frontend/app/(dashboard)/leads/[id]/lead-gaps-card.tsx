'use client';

import type { ScoringFactor } from '@/models';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardLabel } from '@/components/ui/card';
import {
  parseGaps, CATEGORY_CONFIG, CATEGORY_ORDER,
  severityDotCls, severityBadgeCls,
  type GapCategory, type ParsedGap,
} from './lead-detail-utils';

export function LeadGapsCard({ factor }: { factor: ScoringFactor | undefined }) {
  const gaps = parseGaps(factor);
  const totalWeight = gaps.reduce((s, g) => s + g.weight, 0);

  const byCategory = gaps.reduce((acc, gap) => {
    if (!acc[gap.category]) acc[gap.category] = [];
    acc[gap.category]!.push(gap);
    return acc;
  }, {} as Partial<Record<GapCategory, ParsedGap[]>>);

  const activeCategories = CATEGORY_ORDER.filter((k) => byCategory[k]?.length);

  return (
    <Card id="gaps" className="space-y-4">
      <CardHeader>
        <CardLabel>Digital Gaps & Opportunities</CardLabel>
        {gaps.length > 0 && (
          <span className="font-mono text-[12px] font-600 text-crimson">
            +{totalWeight} pts opportunity
          </span>
        )}
      </CardHeader>

      {gaps.length === 0 ? (
        <p className="font-mono text-[12px] text-jade">No digital gaps detected — strong digital presence.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {activeCategories.map((key) => {
              const cfg = CATEGORY_CONFIG[key];
              const items = byCategory[key]!;
              const catWeight = items.reduce((s, g) => s + g.weight, 0);
              return (
                <div key={key} className={cn('rounded-lg border px-3 py-2', cfg.borderCls, cfg.bgCls)}>
                  <p className={cn('font-mono text-[9px] uppercase tracking-wider mb-0.5', cfg.textCls)}>
                    {cfg.label}
                  </p>
                  <p className="font-mono text-[12px] text-ink">
                    {items.length} gap{items.length > 1 ? 's' : ''}{' '}
                    <span className={cfg.textCls}>+{catWeight}</span>
                  </p>
                </div>
              );
            })}
          </div>

          <div className="divide-y divide-ink/[0.04]">
            {activeCategories.map((key) => {
              const cfg = CATEGORY_CONFIG[key];
              const items = byCategory[key]!;
              return (
                <div key={key} className="pt-3 first:pt-0 pb-3 last:pb-0 space-y-1">
                  <p className={cn('font-mono text-[9px] uppercase tracking-wider mb-2', cfg.textCls)}>
                    {cfg.label}
                  </p>
                  {items.map((gap, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', severityDotCls(gap.weight))} />
                      <span className="font-mono text-[12px] text-ink">{gap.label}</span>
                      <span className={cn('font-mono text-[11px] font-700 rounded-full px-2 py-0.5 shrink-0', severityBadgeCls(gap.weight))}>
                        +{gap.weight}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}

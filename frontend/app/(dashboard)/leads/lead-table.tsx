'use client';

import type { Lead, LeadStatus } from '@/models';
import { type ColDef } from '@/constants/lead-columns';
import { Card } from '@/components/ui/card';
import { Th, SortTh, SkeletonRow, PagBtn } from './lead-table-primitives';
import { LeadRowGroup } from './lead-row';

export type { ColDef };
export type { ColId } from '@/constants/lead-columns';
export type SortKey = 'score' | 'createdAt' | 'name' | 'company';
export type SortDir = 'asc' | 'desc';

export { ColumnPicker } from './column-picker';
export { EnrichmentBadge, Th, SortTh, fmtCount } from './lead-table-primitives';

export function LeadTable({
  leads,
  isLoading,
  activeCols,
  selected,
  sortKey,
  sortDir,
  totalPages,
  page,
  total,
  pageSize,
  campaignId,
  hasFilters,
  onToggleAll,
  onSelect,
  onStatusChange,
  onSort,
  onPageChange,
}: {
  leads: Lead[];
  isLoading: boolean;
  activeCols: ColDef[];
  selected: Set<string>;
  sortKey: SortKey;
  sortDir: SortDir;
  totalPages: number;
  page: number;
  total: number;
  pageSize: number;
  campaignId?: string;
  hasFilters?: boolean;
  onToggleAll: () => void;
  onSelect: (id: string) => void;
  onStatusChange: (id: string, status: LeadStatus) => void;
  onSort: (key: SortKey) => void;
  onPageChange: (page: number) => void;
}) {
  const totalColCount = 5 + activeCols.length;

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table
          className="w-full table-fixed"
          style={{ minWidth: 5 * 80 + activeCols.reduce((s, c) => s + c.width, 0) + 32 }}
        >
          <colgroup>
            <col style={{ width: 32 }} />
            <col style={{ width: 200 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 120 }} />
            {activeCols.map((c) => <col key={c.id} style={{ width: c.width }} />)}
          </colgroup>

          <thead>
            <tr className="border-b border-ink/[0.06]">
              <th className="px-3 py-2.5 text-left">
                <input
                  type="checkbox"
                  checked={selected.size === leads.length && leads.length > 0}
                  onChange={onToggleAll}
                  className="rounded border-ink/20 bg-surface"
                />
              </th>
              <SortTh label="Name / Company" sortKey="name"      current={sortKey} dir={sortDir} onSort={onSort} />
              <SortTh label="Score"          sortKey="score"     current={sortKey} dir={sortDir} onSort={onSort} />
              <Th>Tier</Th>
              <Th>Status</Th>
              {activeCols.map((col) =>
                col.id === 'created'
                  ? <SortTh key={col.id} label="Created" sortKey="createdAt" current={sortKey} dir={sortDir} onSort={onSort} />
                  : <Th key={col.id}>{col.label}</Th>
              )}
            </tr>
          </thead>

          <tbody>
            {isLoading
              ? [...Array(8)].map((_, i) => <SkeletonRow key={i} colCount={totalColCount} />)
              : leads.length === 0
                ? (
                  <tr>
                    <td colSpan={totalColCount} className="px-4 py-20 text-center">
                      {hasFilters ? (
                        <div className="flex flex-col items-center gap-2">
                          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="text-mist/40">
                            <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1.5" />
                            <path d="M13 20h14M20 13v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3" />
                          </svg>
                          <p className="font-mono text-[12px] text-mist">No leads match your filters</p>
                          <p className="font-mono text-[10px] text-dusk">Try adjusting or clearing your filters</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3">
                          <svg width="56" height="56" viewBox="0 0 56 56" fill="none" className="text-mist/30">
                            <rect x="8" y="14" width="40" height="30" rx="3" stroke="currentColor" strokeWidth="1.5" />
                            <path d="M8 22h40" stroke="currentColor" strokeWidth="1.5" />
                            <path d="M16 30h8M16 36h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            <path d="M34 33l8 8M42 33l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                          <div>
                            <p className="font-mono text-[13px] font-500 text-mist">No records</p>
                            <p className="mt-0.5 font-mono text-[11px] text-dusk">Run a campaign to start collecting leads</p>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                )
                : leads.map((lead) => (
                  <LeadRowGroup
                    key={lead.id}
                    lead={lead}
                    selected={selected.has(lead.id)}
                    activeCols={activeCols}
                    campaignId={campaignId}
                    onSelect={() => onSelect(lead.id)}
                    onStatusChange={(status) => onStatusChange(lead.id, status)}
                  />
                ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-ink/[0.06] px-4 py-3">
          <span className="num font-mono text-[11px] text-mist">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <PagBtn onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}>‹ Prev</PagBtn>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(1, Math.min(Math.max(1, totalPages - 4), page - 2)) + i;
              return <PagBtn key={p} onClick={() => onPageChange(p)} active={p === page}>{p}</PagBtn>;
            })}
            <PagBtn onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>Next ›</PagBtn>
          </div>
        </div>
      )}
    </Card>
  );
}

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

export { LeadExpandedRow } from './lead-expanded-row';
export { ColumnPicker } from './column-picker';
export { EnrichmentBadge, Th, SortTh, fmtCount } from './lead-table-primitives';

export function LeadTable({
  leads,
  isLoading,
  activeCols,
  selected,
  expandedId,
  sortKey,
  sortDir,
  totalPages,
  page,
  total,
  pageSize,
  onToggleAll,
  onSelect,
  onExpand,
  onStatusChange,
  onSort,
  onPageChange,
}: {
  leads: Lead[];
  isLoading: boolean;
  activeCols: ColDef[];
  selected: Set<string>;
  expandedId: string | null;
  sortKey: SortKey;
  sortDir: SortDir;
  totalPages: number;
  page: number;
  total: number;
  pageSize: number;
  onToggleAll: () => void;
  onSelect: (id: string) => void;
  onExpand: (id: string) => void;
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
                    <td colSpan={totalColCount} className="px-4 py-16 text-center">
                      <p className="font-mono text-[12px] text-mist">No leads match your filters</p>
                    </td>
                  </tr>
                )
                : leads.map((lead) => (
                  <LeadRowGroup
                    key={lead.id}
                    lead={lead}
                    selected={selected.has(lead.id)}
                    expanded={expandedId === lead.id}
                    activeCols={activeCols}
                    totalColCount={totalColCount}
                    onSelect={() => onSelect(lead.id)}
                    onExpand={() => onExpand(lead.id)}
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

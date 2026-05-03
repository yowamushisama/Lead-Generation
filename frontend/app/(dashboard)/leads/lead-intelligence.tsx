'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Download, Filter, LayoutGrid, Table2, Search, X, Columns,
} from 'lucide-react';
import { leads as leadsApi } from '@/lib/api-client';
import type { Lead, LeadStatus, LeadTier } from '@/models';
import { OPTIONAL_COLS } from '@/constants/lead-columns';
import { ALL_STATUSES, TIER_OPTIONS } from '@/constants/leads';
import { SourceToggle, type SourceTab } from '@/components/ui/source-toggle';
import { cn } from '@/lib/utils';
import { exportLeadsCsv } from './leads-csv';
import { LeadBoard } from './lead-board';
import { LeadTable, type SortKey, type SortDir } from './lead-table';
import { ColumnPicker } from './lead-table';
import { useColumnVisibility } from './use-column-visibility';

const PAGE_SIZE = 50;

export function LeadIntelligence() {
  const queryClient = useQueryClient();

  const [view, setView]             = useState<'table' | 'kanban'>('table');
  const [source, setSource]         = useState<SourceTab>('all');
  const [search, setSearch]         = useState('');
  const [tierFilter, setTierFilter] = useState<LeadTier | 'all'>('all');
  const [showFilters, setShowFilters]   = useState(false);
  const [showColPicker, setShowColPicker] = useState(false);
  const [sortKey, setSortKey]   = useState<SortKey>('score');
  const [sortDir, setSortDir]   = useState<SortDir>('desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage]             = useState(1);

  const { visible, toggle, resetToDefaults } = useColumnVisibility();
  const colPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showColPicker) return;
    function handler(e: MouseEvent) {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) {
        setShowColPicker(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColPicker]);

  const { data, isLoading } = useQuery({
    queryKey: ['leads', source, tierFilter, PAGE_SIZE, page],
    queryFn: () =>
      leadsApi.list({
        source: source === 'all' ? undefined : source,
        tier: tierFilter === 'all' ? undefined : tierFilter,
        limit: PAGE_SIZE,
        page,
      }),
    placeholderData: (prev) => prev,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: LeadStatus }) =>
      leadsApi.updateStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  });

  const allLeads = data?.data ?? [];
  const total    = data?.total ?? 0;

  const activeCols = OPTIONAL_COLS.filter((c) => visible[c.id]);

  const filtered = useMemo(() => {
    let rows = allLeads;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (l) =>
          l.name?.toLowerCase().includes(q) ||
          l.company?.toLowerCase().includes(q) ||
          l.role?.toLowerCase().includes(q) ||
          l.email?.toLowerCase().includes(q),
      );
    }
    return [...rows].sort((a, b) => {
      let av: string | number = 0;
      let bv: string | number = 0;
      if (sortKey === 'score')     { av = a.score ?? -1; bv = b.score ?? -1; }
      if (sortKey === 'createdAt') { av = a.createdAt;   bv = b.createdAt; }
      if (sortKey === 'name')      { av = a.name ?? '';  bv = b.name ?? ''; }
      if (sortKey === 'company')   { av = a.company ?? ''; bv = b.company ?? ''; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [allLeads, search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((l) => l.id)));
  }

  function exportCSV() {
    const rows = filtered.filter((l) => selected.size === 0 || selected.has(l.id));
    exportLeadsCsv(rows, activeCols);
  }

  const totalPages   = Math.ceil(total / PAGE_SIZE);
  const sourceCounts = useMemo(
    () => ({ all: total }) as Partial<Record<SourceTab, number>>,
    [total],
  );

  if (view === 'kanban') {
    return (
      <div className="space-y-4 animate-fade-in">
        <ViewHeader view={view} setView={setView} total={total} selectedCount={selected.size} onExport={exportCSV} />
        <LeadBoard />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">

      <ViewHeader view={view} setView={setView} total={total} selectedCount={selected.size} onExport={exportCSV} />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <SourceToggle value={source} onChange={(v) => { setSource(v); setPage(1); }} counts={sourceCounts} />

        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-dusk" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, company, role…"
            className="h-9 w-full rounded-lg border border-ink/[0.06] bg-surface pl-9 pr-4 font-mono text-[11px] text-ink placeholder:text-mist/60 focus:border-aqua/30 focus:outline-none focus:ring-1 focus:ring-aqua/20"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-3 w-3 text-dusk hover:text-mist" />
            </button>
          )}
        </div>

        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value as LeadTier | 'all')}
          className="h-9 rounded-lg border border-ink/[0.06] bg-surface px-3 font-mono text-[11px] text-mist focus:border-aqua/30 focus:outline-none"
        >
          {TIER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'flex h-9 items-center gap-1.5 rounded-lg border px-3.5 font-mono text-[11px] font-500 transition-colors',
            showFilters
              ? 'border-aqua/50 bg-aqua/10 text-aqua shadow-[0_0_0_1px_rgba(0,200,200,0.15)]'
              : 'border-ink/[0.14] bg-surface text-ink/70 hover:border-ink/30 hover:text-ink hover:bg-ink/[0.04]',
          )}
        >
          <Filter className="h-3.5 w-3.5" />
          Filters
        </button>

        {/* Column picker trigger */}
        <div className="relative" ref={colPickerRef}>
          <button
            onClick={() => setShowColPicker((v) => !v)}
            className={cn(
              'flex h-9 items-center gap-1.5 rounded-lg border px-3.5 font-mono text-[11px] font-500 transition-colors',
              showColPicker
                ? 'border-aqua/50 bg-aqua/10 text-aqua shadow-[0_0_0_1px_rgba(0,200,200,0.15)]'
                : 'border-ink/[0.14] bg-surface text-ink/70 hover:border-ink/30 hover:text-ink hover:bg-ink/[0.04]',
            )}
          >
            <Columns className="h-3.5 w-3.5" />
            Columns
          </button>
          {showColPicker && <ColumnPicker visible={visible} onToggle={toggle} onReset={resetToDefaults} />}
        </div>
      </div>

      <LeadTable
        leads={filtered}
        isLoading={isLoading}
        activeCols={activeCols}
        selected={selected}
        sortKey={sortKey}
        sortDir={sortDir}
        totalPages={totalPages}
        page={page}
        total={total}
        pageSize={PAGE_SIZE}
        onToggleAll={toggleAll}
        onSelect={toggleSelect}
        onStatusChange={(id, status) => updateMutation.mutate({ id, status })}
        onSort={toggleSort}
        onPageChange={setPage}
      />
    </div>
  );
}

// ── View header ───────────────────────────────────────────────────────────────

function ViewHeader({
  view, setView, total, selectedCount, onExport,
}: {
  view: 'table' | 'kanban';
  setView: (v: 'table' | 'kanban') => void;
  total: number;
  selectedCount: number;
  onExport: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-xl font-700 text-ink">Lead Intelligence</h1>
        <p className="mt-0.5 font-mono text-[11px] text-mist">
          {total.toLocaleString()} leads
          {selectedCount > 0 && <span className="ml-2 text-aqua">{selectedCount} selected</span>}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 rounded-lg border border-ink/[0.14] bg-surface px-3.5 py-2 font-mono text-[11px] font-500 text-ink/70 transition-colors hover:border-ink/30 hover:text-ink hover:bg-ink/[0.04]"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>

        <div className="flex rounded-lg border border-ink/[0.14] bg-surface overflow-hidden">
          <button
            onClick={() => setView('table')}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-2 font-mono text-[11px] font-500 transition-colors',
              view === 'table'
                ? 'bg-aqua/10 text-aqua'
                : 'text-ink/60 hover:text-ink hover:bg-ink/[0.04]',
            )}
          >
            <Table2 className="h-3.5 w-3.5" />
            Table
          </button>
          <button
            onClick={() => setView('kanban')}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-2 font-mono text-[11px] font-500 transition-colors border-l border-ink/[0.10]',
              view === 'kanban'
                ? 'bg-aqua/10 text-aqua'
                : 'text-ink/60 hover:text-ink hover:bg-ink/[0.04]',
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Board
          </button>
        </div>
      </div>
    </div>
  );
}

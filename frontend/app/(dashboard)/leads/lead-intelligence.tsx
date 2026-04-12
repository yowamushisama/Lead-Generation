'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown, ChevronRight, Download, Filter, LayoutGrid,
  Table2, Search, X, ChevronUp, Check,
} from 'lucide-react';
import { leads as leadsApi } from '@/lib/api-client';
import type { Lead, LeadStatus, LeadTier } from '@/models';
import { TierBadge, StatusBadge, SourceBadge } from '@/components/ui/badge';
import { ScoreBar, ScoreBreakdown } from '@/components/ui/score-bar';
import { SourceToggle, type SourceTab } from '@/components/ui/source-toggle';
import { Card } from '@/components/ui/card';
import { cn, relativeTime } from '@/lib/utils';
import { LeadBoard } from './lead-board';

// ── Status selector options ───────────────────────────────────────────────────

const ALL_STATUSES: LeadStatus[] = [
  'NEW', 'ENRICHED', 'SCORED', 'PERSONALIZED', 'MESSAGE_DRAFTED',
  'MESSAGE_APPROVED', 'OUTREACH_SENT', 'REPLIED', 'MEETING_BOOKED',
  'CONVERTED', 'DISQUALIFIED', 'OPT_OUT',
];

const TIER_OPTIONS: { value: LeadTier | 'all'; label: string }[] = [
  { value: 'all', label: 'All Tiers' },
  { value: 'HOT', label: 'HOT' },
  { value: 'WARM', label: 'WARM' },
  { value: 'COLD', label: 'COLD' },
];

type SortKey = 'score' | 'createdAt' | 'name' | 'company';
type SortDir = 'asc' | 'desc';

export function LeadIntelligence() {
  const queryClient = useQueryClient();

  // View mode
  const [view, setView] = useState<'table' | 'kanban'>('table');

  // Source filter
  const [source, setSource] = useState<SourceTab>('all');

  // Filters
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<LeadTier | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Bulk select
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Pagination
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

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
  const total = data?.total ?? 0;

  // Client-side search + sort
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
    rows = [...rows].sort((a, b) => {
      let av: string | number = 0;
      let bv: string | number = 0;
      if (sortKey === 'score')     { av = a.score ?? -1; bv = b.score ?? -1; }
      if (sortKey === 'createdAt') { av = a.createdAt; bv = b.createdAt; }
      if (sortKey === 'name')      { av = a.name ?? ''; bv = b.name ?? ''; }
      if (sortKey === 'company')   { av = a.company ?? ''; bv = b.company ?? ''; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
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

  // Export CSV
  function exportCSV() {
    const rows = filtered.filter((l) => selected.size === 0 || selected.has(l.id));
    const headers = ['Name', 'Company', 'Role', 'Email', 'Score', 'Tier', 'Status', 'Source', 'Created'];
    const lines = [
      headers.join(','),
      ...rows.map((l) =>
        [
          l.name ?? '',
          l.company ?? '',
          l.role ?? '',
          l.email ?? '',
          l.score ?? '',
          l.tier ?? '',
          l.status,
          l.source,
          l.createdAt.slice(0, 10),
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leads.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Source counts for toggle
  const sourceCounts = useMemo(() => {
    const counts: Partial<Record<SourceTab, number>> = { all: total };
    // we'd need per-source stats from API; stub with total for now
    return counts;
  }, [total]);

  if (view === 'kanban') {
    return (
      <div className="space-y-4 animate-fade-in">
        <ViewHeader
          view={view}
          setView={setView}
          total={total}
          selectedCount={selected.size}
          onExport={exportCSV}
        />
        <LeadBoard />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">

      {/* Header */}
      <ViewHeader
        view={view}
        setView={setView}
        total={total}
        selectedCount={selected.size}
        onExport={exportCSV}
      />

      {/* Source toggle + search row */}
      <div className="flex flex-wrap items-center gap-3">
        <SourceToggle value={source} onChange={(v) => { setSource(v); setPage(1); }} counts={sourceCounts} />

        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-dusk" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, company, role…"
            className="h-9 w-full rounded-lg border border-ink/[0.06] bg-surface pl-9 pr-4 font-mono text-[11px] text-ink placeholder:text-dusk focus:border-aqua/30 focus:outline-none focus:ring-1 focus:ring-aqua/20"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-3 w-3 text-dusk hover:text-mist" />
            </button>
          )}
        </div>

        {/* Tier filter */}
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value as LeadTier | 'all')}
          className="h-9 rounded-lg border border-ink/[0.06] bg-surface px-3 font-mono text-[11px] text-mist focus:border-aqua/30 focus:outline-none"
        >
          {TIER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'flex h-9 items-center gap-1.5 rounded-lg border px-3 font-mono text-[11px] transition-colors',
            showFilters
              ? 'border-aqua/30 bg-aqua/5 text-aqua'
              : 'border-ink/[0.06] bg-surface text-dusk hover:text-mist',
          )}
        >
          <Filter className="h-3 w-3" />
          Filters
        </button>
      </div>

      {/* Table */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] table-fixed">
            <colgroup>
              <col style={{ width: 32 }} />
              <col style={{ width: 200 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 90 }} />
            </colgroup>

            {/* Head */}
            <thead>
              <tr className="border-b border-ink/[0.06]">
                <th className="px-3 py-2.5 text-left">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleAll}
                    className="rounded border-ink/20 bg-surface"
                  />
                </th>
                <SortTh label="Name / Company"  sortKey="name"      current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Role"             sortKey="company"   current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Score"            sortKey="score"     current={sortKey} dir={sortDir} onSort={toggleSort} />
                <Th>Tier</Th>
                <Th>Source</Th>
                <Th>Status</Th>
                <Th>Intent</Th>
                <SortTh label="Created"          sortKey="createdAt" current={sortKey} dir={sortDir} onSort={toggleSort} />
              </tr>
            </thead>

            {/* Body */}
            <tbody>
              {isLoading
                ? [...Array(8)].map((_, i) => <SkeletonRow key={i} />)
                : filtered.length === 0
                  ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-16 text-center">
                        <p className="font-mono text-[12px] text-dusk">No leads match your filters</p>
                      </td>
                    </tr>
                  )
                  : filtered.map((lead) => (
                    <>
                      <LeadRow
                        key={lead.id}
                        lead={lead}
                        selected={selected.has(lead.id)}
                        expanded={expandedId === lead.id}
                        onSelect={() => toggleSelect(lead.id)}
                        onExpand={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                        onStatusChange={(status) => updateMutation.mutate({ id: lead.id, status })}
                      />
                      {expandedId === lead.id && (
                        <LeadExpandedRow key={`${lead.id}-exp`} lead={lead} />
                      )}
                    </>
                  ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-ink/[0.06] px-4 py-3">
            <span className="num font-mono text-[11px] text-dusk">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </span>
            <div className="flex items-center gap-1">
              <PagBtn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                ‹ Prev
              </PagBtn>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(Math.max(1, totalPages - 4), page - 2)) + i;
                return (
                  <PagBtn key={p} onClick={() => setPage(p)} active={p === page}>
                    {p}
                  </PagBtn>
                );
              })}
              <PagBtn onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                Next ›
              </PagBtn>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Table components ──────────────────────────────────────────────────────────

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2.5 text-left">
      <span className="section-label">{children}</span>
    </th>
  );
}

function SortTh({
  label,
  sortKey,
  current,
  dir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <th
      className="cursor-pointer px-3 py-2.5 text-left hover:bg-ink/[0.03]"
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        <span className={cn('section-label', active && 'text-aqua')}>{label}</span>
        {active ? (
          dir === 'desc' ? <ChevronDown className="h-3 w-3 text-aqua" /> : <ChevronUp className="h-3 w-3 text-aqua" />
        ) : (
          <ChevronDown className="h-3 w-3 text-dusk opacity-0 group-hover:opacity-100" />
        )}
      </div>
    </th>
  );
}

function LeadRow({
  lead,
  selected,
  expanded,
  onSelect,
  onExpand,
  onStatusChange,
}: {
  lead: Lead;
  selected: boolean;
  expanded: boolean;
  onSelect: () => void;
  onExpand: () => void;
  onStatusChange: (s: LeadStatus) => void;
}) {
  const tierBorderClass =
    lead.tier === 'HOT' ? 'row-hot' :
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

      {/* Name / Company */}
      <td className="px-3 py-2.5">
        <button
          className="flex w-full items-center gap-1.5 text-left"
          onClick={onExpand}
        >
          {expanded
            ? <ChevronDown className="h-3 w-3 shrink-0 text-aqua" />
            : <ChevronRight className="h-3 w-3 shrink-0 text-dusk group-hover:text-mist" />}
          <div className="min-w-0">
            <p className="truncate text-[12px] font-500 text-ink">
              {lead.company ?? lead.name ?? '—'}
            </p>
            {lead.name && lead.company && (
              <p className="truncate font-mono text-[10px] text-dusk">{lead.name}</p>
            )}
          </div>
        </button>
      </td>

      {/* Role */}
      <td className="px-3 py-2.5">
        <span className="truncate font-mono text-[11px] text-mist block">{lead.role ?? '—'}</span>
      </td>

      {/* Score */}
      <td className="px-3 py-2.5">
        <ScoreBar score={lead.score} tier={lead.tier} size="sm" />
      </td>

      {/* Tier */}
      <td className="px-3 py-2.5">
        {lead.tier ? <TierBadge tier={lead.tier} /> : <span className="text-dusk">—</span>}
      </td>

      {/* Source */}
      <td className="px-3 py-2.5">
        <SourceBadge source={lead.source} />
      </td>

      {/* Status — inline editable */}
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

      {/* Intent */}
      <td className="px-3 py-2.5">
        {lead.intentType ? (
          <span className="font-mono text-[10px] text-orchid">{lead.intentType}</span>
        ) : (
          <span className="text-dusk">—</span>
        )}
      </td>

      {/* Created */}
      <td className="px-3 py-2.5">
        <span className="num font-mono text-[10px] text-dusk">{relativeTime(lead.createdAt)}</span>
      </td>
    </tr>
  );
}

function LeadExpandedRow({ lead }: { lead: Lead }) {
  return (
    <tr className="bg-elevated/50">
      <td colSpan={9} className="px-6 py-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">

          {/* Score breakdown */}
          {lead.scoreBreakdown && (
            <div className="rounded-lg border border-ink/[0.06] bg-surface p-3">
              <ScoreBreakdown breakdown={lead.scoreBreakdown} />
            </div>
          )}

          {/* Intent & signals */}
          <div className="rounded-lg border border-ink/[0.06] bg-surface p-3 space-y-2.5">
            <p className="section-label">Intent Signals</p>
            {lead.intentType && (
              <Field label="Type" value={<span className="text-orchid">{lead.intentType}</span>} />
            )}
            {lead.intentUrgency && (
              <Field label="Urgency" value={<span className="text-gold">{lead.intentUrgency}</span>} />
            )}
            {lead.budgetSignal && (
              <Field label="Budget" value={lead.budgetSignal} />
            )}
            {lead.intentReasoning && (
              <Field label="Reasoning" value={<span className="text-[10px] text-mist leading-relaxed">{lead.intentReasoning}</span>} />
            )}
          </div>

          {/* Pain points / desires */}
          <div className="rounded-lg border border-ink/[0.06] bg-surface p-3 space-y-2.5">
            <p className="section-label">Psychographic Signals</p>
            {lead.painPoints && lead.painPoints.length > 0 && (
              <div>
                <p className="font-mono text-[9px] uppercase tracking-wider text-crimson/70 mb-1">Pain Points</p>
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
                <p className="font-mono text-[9px] uppercase tracking-wider text-jade/70 mb-1">Desires</p>
                <ul className="space-y-0.5">
                  {lead.desires.map((d, i) => (
                    <li key={i} className="font-mono text-[10px] text-mist flex items-start gap-1">
                      <span className="text-jade mt-0.5">·</span>{d}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {lead.toneProfile && (
              <Field label="Tone Profile" value={<span className="text-aqua">{lead.toneProfile}</span>} />
            )}
            {lead.recommendedChannel && (
              <Field label="Channel" value={lead.recommendedChannel} />
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-wider text-dusk mb-0.5">{label}</p>
      <div className="font-mono text-[11px] text-mist">{value}</div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-ink/[0.04]">
      {[...Array(9)].map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="skeleton h-3.5 rounded" style={{ width: `${60 + Math.random() * 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

function PagBtn({
  children,
  onClick,
  disabled,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded px-2.5 py-1 font-mono text-[10px] transition-colors',
        active
          ? 'bg-aqua/10 text-aqua'
          : 'text-dusk hover:bg-ink/[0.06] hover:text-mist disabled:opacity-40',
      )}
    >
      {children}
    </button>
  );
}

// ── View header ───────────────────────────────────────────────────────────────

function ViewHeader({
  view,
  setView,
  total,
  selectedCount,
  onExport,
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
        <p className="mt-0.5 font-mono text-[11px] text-dusk">
          {total.toLocaleString()} leads
          {selectedCount > 0 && <span className="ml-2 text-aqua">{selectedCount} selected</span>}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {/* Export */}
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 rounded-lg border border-ink/[0.06] bg-surface px-3 py-2 font-mono text-[11px] text-dusk transition-colors hover:text-mist"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>

        {/* View toggle */}
        <div className="flex rounded-lg border border-ink/[0.06] bg-surface overflow-hidden">
          <button
            onClick={() => setView('table')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 transition-colors',
              view === 'table' ? 'bg-aqua/10 text-aqua' : 'text-dusk hover:text-mist',
            )}
          >
            <Table2 className="h-3.5 w-3.5" />
            <span className="font-mono text-[11px]">Table</span>
          </button>
          <button
            onClick={() => setView('kanban')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 transition-colors border-l border-ink/[0.06]',
              view === 'kanban' ? 'bg-aqua/10 text-aqua' : 'text-dusk hover:text-mist',
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="font-mono text-[11px]">Board</span>
          </button>
        </div>
      </div>
    </div>
  );
}

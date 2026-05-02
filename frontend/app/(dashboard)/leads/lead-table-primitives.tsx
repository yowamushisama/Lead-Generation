'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SortKey, SortDir } from './lead-table';

export function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2.5 text-left">
      <span className="section-label">{children}</span>
    </th>
  );
}

export function SortTh({
  label, sortKey, current, dir, onSort,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <th className="cursor-pointer px-3 py-2.5 text-left hover:bg-ink/[0.03]" onClick={() => onSort(sortKey)}>
      <div className="flex items-center gap-1">
        <span className={cn('section-label', active && 'text-aqua')}>{label}</span>
        {active
          ? dir === 'desc' ? <ChevronDown className="h-3 w-3 text-aqua" /> : <ChevronUp className="h-3 w-3 text-aqua" />
          : <ChevronDown className="h-3 w-3 text-dusk opacity-0 group-hover:opacity-100" />}
      </div>
    </th>
  );
}

export function EnrichmentBadge({ status }: { status: string }) {
  const cls =
    status === 'OK'          ? 'text-jade border-jade/30 bg-jade/5' :
    status === 'NO_WEBSITE'  ? 'text-dusk border-ink/20 bg-ink/5' :
    status === 'UNREACHABLE' ? 'text-crimson border-crimson/30 bg-crimson/5' :
    status === 'TIMEOUT'     ? 'text-gold border-gold/30 bg-gold/5' :
                               'text-mist border-ink/20';
  return (
    <span className={cn('font-mono text-[9px] uppercase tracking-wider border rounded px-1.5 py-0.5', cls)}>
      {status.replace('_', ' ')}
    </span>
  );
}

export function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-wider text-mist mb-0.5">{label}</p>
      <div className="font-mono text-[11px] text-mist">{value}</div>
    </div>
  );
}

export function YesNo({ yes }: { yes: boolean }) {
  return (
    <span className={cn('font-mono text-[10px]', yes ? 'text-jade' : 'text-dusk')}>
      {yes ? 'Yes' : 'No'}
    </span>
  );
}

export function SkeletonRow({ colCount }: { colCount: number }) {
  return (
    <tr className="border-b border-ink/[0.04]">
      {[...Array(colCount)].map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="skeleton h-3.5 rounded" style={{ width: `${60 + Math.random() * 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

export function PagBtn({
  children, onClick, disabled, active,
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
        active ? 'bg-aqua/10 text-aqua' : 'text-dusk hover:bg-ink/[0.06] hover:text-mist disabled:opacity-40',
      )}
    >
      {children}
    </button>
  );
}

export function fmtCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

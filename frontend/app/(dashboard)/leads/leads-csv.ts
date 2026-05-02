import type { Lead } from '@/models';
import type { ColDef, ColId } from '@/constants/lead-columns';
import { csvFilename } from '@/lib/utils';
import { fmtCount } from './lead-table-primitives';

const FIXED_HEADERS = ['Name', 'Company', 'Score', 'Tier', 'Status'];

function colToString(lead: Lead, colId: ColId): string {
  switch (colId) {
    case 'role':             return lead.role ?? '';
    case 'source':           return lead.source ?? '';
    case 'intent':           return lead.intentType ?? '';
    case 'created':          return lead.createdAt.slice(0, 10);
    case 'location':         return lead.location ?? '';
    case 'industry':         return lead.industry ?? '';
    case 'email':            return lead.email ?? '';
    case 'phone':            return lead.phone ?? '';
    case 'website':          return lead.website ?? '';
    case 'rating':           return lead.rating != null ? String(lead.rating) : '';
    case 'reviews':          return lead.reviewCount != null ? fmtCount(lead.reviewCount) : '';
    case 'businessType':     return lead.businessType ?? '';
    case 'enrichmentStatus': return lead.enrichmentStatus ?? '';
    case 'socialHandles': {
      const s = lead.socialHandles;
      if (!s) return '';
      return [s.instagram, s.facebook, s.tiktok].filter(Boolean).join(' | ');
    }
    default: return '';
  }
}

function quoteCell(v: string | number | null | undefined): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

export function exportLeadsCsv(rows: Lead[], activeCols: ColDef[]): void {
  const headers = [...FIXED_HEADERS, ...activeCols.map((c) => c.label)];

  const lines = [
    headers.join(','),
    ...rows.map((l) => {
      const fixed = [l.name ?? '', l.company ?? '', l.score ?? '', l.tier ?? '', l.status];
      const opt   = activeCols.map((c) => colToString(l, c.id));
      return [...fixed, ...opt].map(quoteCell).join(',');
    }),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = csvFilename('leads');
  a.click();
  URL.revokeObjectURL(url);
}

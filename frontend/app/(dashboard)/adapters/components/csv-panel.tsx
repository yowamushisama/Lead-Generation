'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, Upload, X, RefreshCw } from 'lucide-react';
import { campaigns as campaignsApi } from '@/lib/api-client';
import { cn, relativeTime } from '@/lib/utils';
import { FormField, TagInputMulti, Toggle } from './adapter-ui';

// ── Types & constants ──────────────────────────────────────────────────────────

type ColumnMapping = {
  name: string; email: string; company: string; role: string;
  industry: string; location: string; phone: string; website: string; bio: string;
};

const LEAD_FIELDS: (keyof ColumnMapping)[] = [
  'name', 'email', 'company', 'role', 'industry', 'location', 'phone', 'website', 'bio',
];

const FIELD_ALIASES: Record<keyof ColumnMapping, string[]> = {
  name:     ['name', 'full_name', 'contact_name'],
  email:    ['email', 'email_address'],
  company:  ['company', 'organization', 'employer'],
  role:     ['role', 'title', 'job_title', 'position'],
  industry: ['industry', 'sector'],
  location: ['location', 'city', 'region'],
  phone:    ['phone', 'telephone', 'mobile'],
  website:  ['website', 'linkedin', 'url'],
  bio:      ['bio', 'about', 'summary'],
};

const MOCK_IMPORT_HISTORY = [
  { id: '1', filename: 'leads_q1_2026.csv',    importedAt: new Date(Date.now() - 86_400_000).toISOString(),      rowCount: 341, status: 'success' as const, skipped: 12 },
  { id: '2', filename: 'prospects_march.xlsx', importedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(), rowCount: 89,  status: 'partial' as const, skipped: 4  },
  { id: '3', filename: 'contacts_export.csv',  importedAt: new Date(Date.now() - 7 * 86_400_000).toISOString(), rowCount: 512, status: 'success' as const, skipped: 0  },
];

function autoDetectMapping(headers: string[]): Partial<ColumnMapping> {
  const result: Partial<ColumnMapping> = {};
  for (const header of headers) {
    const lower = header.toLowerCase().replace(/\s+/g, '_');
    for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [keyof ColumnMapping, string[]][]) {
      if (aliases.some((a) => lower.includes(a)) && !result[field]) {
        result[field] = header;
      }
    }
  }
  return result;
}

// ── CSVDetailPanel ─────────────────────────────────────────────────────────────

export function CSVDetailPanel() {
  const [dragOver, setDragOver]       = useState(false);
  const [file, setFile]               = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders]   = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [mapping, setMapping]         = useState<Partial<ColumnMapping>>({});
  const [delimiter, setDelimiter]     = useState<'comma' | 'semicolon' | 'tab'>('comma');
  const [skipHeader, setSkipHeader]   = useState(true);
  const [maxRows, setMaxRows]         = useState(1000);
  const [deduplicate, setDeduplicate] = useState(true);
  const [campaignId, setCampaignId]   = useState('');
  const [importing, setImporting]     = useState(false);
  const [importProgress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => campaignsApi.list(),
  });

  const delimChar = delimiter === 'comma' ? ',' : delimiter === 'semicolon' ? ';' : '\t';

  const parseFile = useCallback((f: File, dc: string) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(Boolean);
      if (lines.length === 0) return;
      const headers = lines[0].split(dc).map((h) => h.trim().replace(/^"|"$/g, ''));
      const rows    = lines.slice(1, 6).map((l) => l.split(dc).map((c) => c.trim().replace(/^"|"$/g, '')));
      setCsvHeaders(headers);
      setPreviewRows(rows);
      setMapping(autoDetectMapping(headers));
    };
    reader.readAsText(f);
  }, []);

  function handleFile(f: File) { setFile(f); parseFile(f, delimChar); }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  function clearFile() {
    setFile(null);
    setCsvHeaders([]);
    setPreviewRows([]);
    setMapping({});
  }

  // Re-parse when delimiter changes
  useEffect(() => { if (file) parseFile(file, delimChar); }, [delimiter, file, delimChar, parseFile]);

  function triggerImport() {
    setImporting(true);
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) { clearInterval(interval); setImporting(false); return 100; }
        return p + Math.floor(Math.random() * 15) + 5;
      });
    }, 200);
    // TODO: wire to POST /api/v1/leads/bulk with parsed CSV data
  }

  function updateMapping(header: string, field: keyof ColumnMapping | '') {
    const next = { ...mapping };
    for (const k of Object.keys(next) as (keyof ColumnMapping)[]) {
      if (next[k] === header) delete next[k];
    }
    if (field) next[field] = header;
    setMapping(next);
  }

  return (
    <div className="space-y-5">
      {/* Panel header */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: '#7C3AED15', color: '#7C3AED' }}>
          <FileSpreadsheet className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-display text-[14px] font-600 text-ink">CSV Import</h2>
          <p className="font-mono text-[10px] text-dusk">Upload a CSV or Excel file to import leads</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Left column: upload + settings */}
        <div className="space-y-4">
          <DropZone
            dragOver={dragOver}
            file={file}
            inputRef={inputRef}
            onDragOver={() => setDragOver(true)}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onFile={handleFile}
            onClear={clearFile}
          />

          <ImportSettings
            delimiter={delimiter}
            setDelimiter={setDelimiter}
            skipHeader={skipHeader}
            setSkipHeader={setSkipHeader}
            deduplicate={deduplicate}
            setDeduplicate={setDeduplicate}
            maxRows={maxRows}
            setMaxRows={setMaxRows}
            campaigns={campaigns}
            campaignId={campaignId}
            setCampaignId={setCampaignId}
          />

          {/* Import button + progress bar */}
          <div className="space-y-1.5">
            <button
              disabled={!file || importing}
              onClick={triggerImport}
              className="flex items-center gap-2 rounded-lg px-4 py-2 font-mono text-[11px] font-500 transition-all disabled:opacity-40"
              style={{ background: '#7C3AED20', color: '#7C3AED', border: '1px solid #7C3AED30' }}
            >
              {importing
                ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Importing…</>
                : <><Upload className="h-3.5 w-3.5" /> Import Leads</>
              }
            </button>
            {importing && (
              <div className="h-0.5 w-full rounded-full bg-ink/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full bg-orchid transition-all duration-200"
                  style={{ width: `${Math.min(importProgress, 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right column: column mapper + preview + history */}
        <div className="space-y-4">
          {csvHeaders.length > 0 ? (
            <>
              <ColumnMapper
                csvHeaders={csvHeaders}
                mapping={mapping}
                onUpdate={updateMapping}
              />
              {previewRows.length > 0 && (
                <PreviewTable headers={csvHeaders} rows={previewRows} />
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-ink/[0.06] py-12">
              <FileSpreadsheet className="h-8 w-8 text-dusk/40" />
              <p className="font-mono text-[11px] text-dusk">
                Upload a file to see preview and column mapping
              </p>
            </div>
          )}

          <ImportHistory records={MOCK_IMPORT_HISTORY} />
        </div>
      </div>
    </div>
  );
}

// ── DropZone ───────────────────────────────────────────────────────────────────

function DropZone({
  dragOver, file, inputRef, onDragOver, onDragLeave, onDrop, onFile, onClear,
}: {
  dragOver: boolean;
  file: File | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onFile: (f: File) => void;
  onClear: () => void;
}) {
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 transition-all',
        dragOver ? 'border-orchid/50 bg-orchid/5' : 'border-ink/[0.08] hover:border-orchid/30 hover:bg-orchid/[0.02]',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      {file ? (
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-orchid" />
          <span className="font-mono text-[12px] text-ink">{file.name}</span>
          <button onClick={(e) => { e.stopPropagation(); onClear(); }}>
            <X className="h-4 w-4 text-dusk hover:text-crimson" />
          </button>
        </div>
      ) : (
        <>
          <Upload className="h-6 w-6 text-dusk" />
          <div className="text-center">
            <p className="font-mono text-[12px] text-mist">Drop CSV or Excel file here</p>
            <p className="font-mono text-[10px] text-dusk">or click to browse · .csv .xlsx .xls</p>
          </div>
        </>
      )}
    </div>
  );
}

// ── ImportSettings ─────────────────────────────────────────────────────────────

function ImportSettings({
  delimiter, setDelimiter,
  skipHeader, setSkipHeader,
  deduplicate, setDeduplicate,
  maxRows, setMaxRows,
  campaigns, campaignId, setCampaignId,
}: {
  delimiter: 'comma' | 'semicolon' | 'tab';
  setDelimiter: (v: 'comma' | 'semicolon' | 'tab') => void;
  skipHeader: boolean; setSkipHeader: (v: boolean) => void;
  deduplicate: boolean; setDeduplicate: (v: boolean) => void;
  maxRows: number; setMaxRows: (v: number) => void;
  campaigns: { id: string; name: string }[];
  campaignId: string; setCampaignId: (v: string) => void;
}) {
  return (
    <div className="rounded-xl border border-ink/[0.06] bg-elevated p-3 space-y-3">
      <p className="section-label">Import Settings</p>

      <FormField label="Delimiter">
        <div className="flex flex-wrap gap-1.5">
          {(['comma', 'semicolon', 'tab'] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDelimiter(d)}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 font-mono text-[10px] border transition-colors',
                delimiter === d
                  ? 'border-orchid/30 bg-orchid/10 text-orchid'
                  : 'border-ink/[0.06] text-dusk hover:text-mist',
              )}
            >
              {d === 'comma' ? 'Comma (,)' : d === 'semicolon' ? 'Semicolon (;)' : 'Tab (\\t)'}
            </button>
          ))}
        </div>
      </FormField>

      <div className="flex items-center gap-6">
        <Toggle checked={skipHeader}   onChange={setSkipHeader}   label="Skip header row" />
        <Toggle checked={deduplicate}  onChange={setDeduplicate}  label="Skip duplicate emails" />
      </div>

      <FormField label={`Max Rows: ${maxRows.toLocaleString()}`}>
        <input
          type="range" min={10} max={5000} step={10} value={maxRows}
          onChange={(e) => setMaxRows(Number(e.target.value))}
          className="w-full accent-[#7C3AED]"
        />
        <div className="flex justify-between font-mono text-[9px] text-dusk">
          <span>10</span><span>5,000</span>
        </div>
      </FormField>

      <FormField label="Assign to Campaign">
        <select
          value={campaignId}
          onChange={(e) => setCampaignId(e.target.value)}
          className="field-input"
        >
          <option value="">— None —</option>
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </FormField>
    </div>
  );
}

// ── ColumnMapper ───────────────────────────────────────────────────────────────

function ColumnMapper({
  csvHeaders, mapping, onUpdate,
}: {
  csvHeaders: string[];
  mapping: Partial<ColumnMapping>;
  onUpdate: (header: string, field: keyof ColumnMapping | '') => void;
}) {
  return (
    <div className="rounded-xl border border-ink/[0.06] bg-elevated overflow-hidden">
      <div className="px-3 py-2 border-b border-ink/[0.06]">
        <p className="section-label">Column Mapping</p>
        <p className="font-mono text-[9px] text-dusk mt-0.5">Map CSV headers to lead fields</p>
      </div>
      <div className="divide-y divide-ink/[0.04] max-h-64 overflow-y-auto">
        {csvHeaders.map((header) => (
          <div key={header} className="flex items-center gap-3 px-3 py-1.5">
            <span className="flex-1 font-mono text-[10px] text-mist truncate">{header}</span>
            <span className="text-dusk font-mono text-[10px]">→</span>
            <select
              value={Object.entries(mapping).find(([, v]) => v === header)?.[0] ?? ''}
              onChange={(e) => onUpdate(header, e.target.value as keyof ColumnMapping | '')}
              className="rounded-md border border-ink/[0.06] bg-surface px-2 py-0.5 font-mono text-[10px] text-ink focus:border-orchid/30 focus:outline-none"
            >
              <option value="">— skip —</option>
              {LEAD_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PreviewTable ───────────────────────────────────────────────────────────────

function PreviewTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="rounded-xl border border-ink/[0.06] overflow-hidden">
      <div className="px-3 py-2 border-b border-ink/[0.06] bg-elevated">
        <p className="section-label">Preview (first {rows.length} rows)</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-ink/[0.06] bg-elevated">
              {headers.map((h) => (
                <th key={h} className="px-3 py-1.5 font-mono text-[9px] text-dusk whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-ink/[0.03] hover:bg-elevated/50">
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-1.5 font-mono text-[10px] text-mist whitespace-nowrap max-w-[160px] truncate">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── ImportHistory ──────────────────────────────────────────────────────────────

function ImportHistory({
  records,
}: {
  records: typeof MOCK_IMPORT_HISTORY;
}) {
  return (
    <div className="rounded-xl border border-ink/[0.06] overflow-hidden">
      <div className="px-3 py-2 border-b border-ink/[0.06] bg-elevated">
        <p className="section-label">Import History</p>
      </div>
      <div className="divide-y divide-ink/[0.04]">
        {records.map((record) => (
          <div key={record.id} className="flex items-center gap-3 px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="font-mono text-[11px] text-mist truncate">{record.filename}</p>
              <p className="font-mono text-[9px] text-dusk">{relativeTime(record.importedAt)}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[11px] text-ink">{record.rowCount} leads</p>
              {record.skipped > 0 && (
                <p className="font-mono text-[9px] text-dusk">{record.skipped} skipped</p>
              )}
            </div>
            <span
              className={cn(
                'rounded-md px-1.5 py-0.5 font-mono text-[9px] border',
                record.status === 'success' ? 'border-jade/20 bg-jade/10 text-jade' :
                record.status === 'partial' ? 'border-gold/20 bg-gold/10 text-gold' :
                'border-crimson/20 bg-crimson/10 text-crimson',
              )}
            >
              {record.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, Upload, X, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { campaigns as campaignsApi, leads as leadsApi } from '@/lib/api-client';
import { cn, relativeTime } from '@/lib/utils';
import { FormField, TagInputMulti, Toggle } from './adapter-ui';
import { ColumnMapping, LEAD_FIELDS, MOCK_IMPORT_HISTORY } from './csv/constants';
import { parseCsv, autoDetectMapping } from './csv/utils';

// ── CSVDetailPanel ─────────────────────────────────────────────────────────────

export function CSVDetailPanel() {
  const [dragOver, setDragOver]       = useState(false);
  const [file, setFile]               = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders]   = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [mapping, setMapping]         = useState<Partial<ColumnMapping>>({});
  const [delimiter, setDelimiter]     = useState<'comma' | 'semicolon' | 'tab'>('comma');
  const [skipHeader, setSkipHeader]   = useState(true);
  const [maxRows, setMaxRows]         = useState(500);
  const [deduplicate, setDeduplicate] = useState(true);
  const [campaignId, setCampaignId]   = useState('');
  const [importing, setImporting]     = useState(false);
  const [importProgress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ created: number; duplicates: number; errors: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => campaignsApi.list(),
  });

  const delimChar = delimiter === 'comma' ? ',' : delimiter === 'semicolon' ? ';' : '\t';

  const parseFile = useCallback((f: File, dc: string) => {
    const isExcel = f.name.endsWith('.xlsx') || f.name.endsWith('.xls');
    const reader  = new FileReader();

    reader.onload = (e) => {
      const buf = e.target?.result;
      if (buf == null) return;

      if (isExcel) {
        const wb      = XLSX.read(buf, { type: 'array' });
        const sheet   = wb.Sheets[wb.SheetNames[0]];
        // sheet_to_json with header:1 gives rows as string[][]
        const allRows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' });
        if (allRows.length === 0) return;
        const headers  = (allRows[0] as string[]).map((h) => String(h).trim());
        const dataRows = allRows.slice(1, 6).map((r) => (r as string[]).map((c) => String(c).trim()));
        setCsvHeaders(headers);
        setPreviewRows(dataRows);
        setMapping(autoDetectMapping(headers));
      } else {
        const text    = new TextDecoder().decode(buf as ArrayBuffer);
        const allRows = parseCsv(text, dc);
        if (allRows.length === 0) return;
        const headers = allRows[0];
        const rows    = allRows.slice(1, 6);
        setCsvHeaders(headers);
        setPreviewRows(rows);
        setMapping(autoDetectMapping(headers));
      }
    };

    reader.readAsArrayBuffer(f);
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
    setImportResult(null);
    setImportError(null);
    setProgress(0);
  }

  // Re-parse when delimiter changes
  useEffect(() => { if (file) parseFile(file, delimChar); }, [delimiter, file, delimChar, parseFile]);

  async function parseAllRows(f: File, dc: string): Promise<Record<string, string>[]> {
    const isExcel = f.name.endsWith('.xlsx') || f.name.endsWith('.xls');
    const buf     = await f.arrayBuffer();

    if (isExcel) {
      const wb       = XLSX.read(buf, { type: 'array' });
      const sheet    = wb.Sheets[wb.SheetNames[0]];
      const allRows  = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' });
      if (allRows.length === 0) return [];
      const headers  = (allRows[0] as string[]).map((h) => String(h).trim());
      const dataRows = allRows.slice(1).slice(0, maxRows);
      return (dataRows as string[][]).map((r) => {
        const row: Record<string, string> = {};
        headers.forEach((h, i) => { const v = String(r[i] ?? '').trim(); if (v) row[h] = v; });
        return row;
      });
    }

    const text      = new TextDecoder().decode(buf);
    const allRows   = parseCsv(text, dc);
    if (allRows.length === 0) return [];
    const headers   = allRows[0];
    const dataRows  = (skipHeader ? allRows.slice(1) : allRows).slice(0, maxRows);
    return dataRows.map((cells) => {
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { const v = cells[i] ?? ''; if (v) row[h] = v; });
      return row;
    });
  }

  async function triggerImport() {
    if (!file) return;
    setImporting(true);
    setProgress(10);
    setImportResult(null);
    setImportError(null);

    try {
      setProgress(30);

      const rows = await parseAllRows(file, delimChar);
      setProgress(50);

      // Build the payload using the column mapping
      const mapped = rows
        .map((row) => {
          const lead: Record<string, string | undefined> = {
            source: 'csv_import',
            sourceType: 'discovery',
          };
          for (const [field, header] of Object.entries(mapping) as [string, string][]) {
            if (row[header]) lead[field] = row[header];
          }
          if (campaignId) lead.campaignId = campaignId;
          return lead;
        })
        .filter((l) => l.name); // name is required

      // Deduplicate by email within the file when the toggle is on
      const seen = new Set<string>();
      const payload = deduplicate
        ? mapped.filter((l) => {
            if (!l.email) return true;
            if (seen.has(l.email)) return false;
            seen.add(l.email);
            return true;
          })
        : mapped;

      setProgress(70);

      const result = await leadsApi.bulkCreate(payload);
      setProgress(100);
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Import failed';
      setImportError(message);
    } finally {
      setImporting(false);
    }
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
          <p className="font-mono text-[10px] text-mist">Upload a CSV or Excel file to import leads</p>
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
              className="group flex items-center gap-2 rounded-lg px-4 py-2.5 font-mono text-[11px] font-600 transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background: '#7C3AED',
                color: '#ffffff',
                border: '1px solid #6D28D9',
                boxShadow: '0 1px 3px rgba(124,58,237,0.35)',
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.background = '#6D28D9';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(124,58,237,0.45)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#7C3AED';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(124,58,237,0.35)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
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
            {importResult && (
              <div className="flex items-start gap-2 rounded-lg border border-jade/20 bg-jade/[0.06] p-2.5">
                <CheckCircle className="h-3.5 w-3.5 shrink-0 text-jade mt-0.5" />
                <div className="font-mono text-[10px] text-jade space-y-0.5">
                  <p className="font-600">Import complete</p>
                  <p>{importResult.created} created · {importResult.duplicates} duplicates skipped · {importResult.errors} errors</p>
                </div>
              </div>
            )}
            {importError && (
              <div className="flex items-start gap-2 rounded-lg border border-crimson/20 bg-crimson/[0.06] p-2.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-crimson mt-0.5" />
                <p className="font-mono text-[10px] text-crimson">{importError}</p>
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
              <p className="font-mono text-[11px] text-mist">
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
            <p className="font-mono text-[10px] text-mist">or click to browse · .csv .xlsx .xls</p>
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
                  : 'border-ink/[0.06] text-mist hover:text-ink',
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
          type="range" min={10} max={500} step={10} value={maxRows}
          onChange={(e) => setMaxRows(Number(e.target.value))}
          className="w-full accent-[#7C3AED]"
        />
        <div className="flex justify-between font-mono text-[9px] text-mist">
          <span>10</span><span>500</span>
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
        <p className="font-mono text-[9px] text-mist mt-0.5">Map CSV headers to lead fields</p>
      </div>
      <div className="divide-y divide-ink/[0.04] max-h-64 overflow-y-auto">
        {csvHeaders.map((header) => (
          <div key={header} className="flex items-center gap-3 px-3 py-1.5">
            <span className="flex-1 font-mono text-[10px] text-mist truncate">{header}</span>
            <span className="text-mist font-mono text-[10px]">→</span>
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
                <th key={h} className="px-3 py-1.5 font-mono text-[9px] text-mist whitespace-nowrap">{h}</th>
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
              <p className="font-mono text-[9px] text-mist">{relativeTime(record.importedAt)}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[11px] text-ink">{record.rowCount} leads</p>
              {record.skipped > 0 && (
                <p className="font-mono text-[9px] text-mist">{record.skipped} skipped</p>
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

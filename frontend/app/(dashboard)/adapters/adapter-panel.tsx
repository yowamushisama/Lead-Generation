'use client';

import { useState, useRef } from 'react';
import {
  Link2, Map, FileSpreadsheet, Webhook, Play, RefreshCw,
  Copy, Check, Eye, EyeOff, Upload, X, ChevronRight, Info,
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// ── Adapter types ─────────────────────────────────────────────────────────────

type AdapterStatus = 'active' | 'inactive' | 'running' | 'error';

interface AdapterMeta {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  leadsIngested: number;
  lastRun?: string;
  status: AdapterStatus;
  errorRate: number;
}

const ADAPTERS: AdapterMeta[] = [
  {
    id: 'linkedin',
    label: 'LinkedIn',
    description: 'Scrapes LinkedIn posts by keyword using Playwright stealth automation. Extracts buyer intent signals from content.',
    icon: Link2,
    color: '#4A9EF5',
    leadsIngested: 847,
    lastRun: new Date(Date.now() - 3_600_000).toISOString(),
    status: 'active',
    errorRate: 2.4,
  },
  {
    id: 'google_maps',
    label: 'Google Maps',
    description: 'Discovers local businesses via Google Places API. Returns business name, rating, review count, and contact info.',
    icon: Map,
    color: '#10B981',
    leadsIngested: 1243,
    lastRun: new Date(Date.now() - 7_200_000).toISOString(),
    status: 'active',
    errorRate: 0.8,
  },
  {
    id: 'csv',
    label: 'CSV Import',
    description: 'Import leads from CSV or Excel files. Auto-detects name, email, company, role, industry, location columns.',
    icon: FileSpreadsheet,
    color: '#7C3AED',
    leadsIngested: 2109,
    lastRun: new Date(Date.now() - 86_400_000).toISOString(),
    status: 'inactive',
    errorRate: 0,
  },
  {
    id: 'webhook',
    label: 'Webhook',
    description: 'Receive leads via HTTP POST from any external tool. HMAC signature verification ensures request authenticity.',
    icon: Webhook,
    color: '#F59E0B',
    leadsIngested: 322,
    lastRun: new Date(Date.now() - 1_800_000).toISOString(),
    status: 'active',
    errorRate: 0.5,
  },
];

const STATUS_LABELS: Record<AdapterStatus, { label: string; dot: string; text: string }> = {
  active:   { label: 'Active',   dot: 'dot-live',    text: 'text-jade' },
  inactive: { label: 'Inactive', dot: 'dot-idle',    text: 'text-dusk' },
  running:  { label: 'Running',  dot: 'dot-warning', text: 'text-gold' },
  error:    { label: 'Error',    dot: 'dot-error',   text: 'text-crimson' },
};

export function AdapterPanel() {
  const [activeAdapter, setActiveAdapter] = useState<string>('linkedin');

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="font-display text-xl font-700 text-ink">Adapters</h1>
        <p className="mt-0.5 font-mono text-[11px] text-dusk">
          Configure and trigger data source adapters
        </p>
      </div>

      {/* Adapter grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {ADAPTERS.map((adapter) => (
          <AdapterCard
            key={adapter.id}
            adapter={adapter}
            isActive={activeAdapter === adapter.id}
            onSelect={() => setActiveAdapter(adapter.id === activeAdapter ? '' : adapter.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Adapter card ──────────────────────────────────────────────────────────────

function AdapterCard({
  adapter,
  isActive,
  onSelect,
}: {
  adapter: AdapterMeta;
  isActive: boolean;
  onSelect: () => void;
}) {
  const Icon = adapter.icon;
  const statusInfo = STATUS_LABELS[adapter.status];
  const [enabled, setEnabled] = useState(adapter.status !== 'inactive');

  return (
    <div
      className={cn(
        'rounded-xl border bg-surface transition-all duration-200',
        isActive ? 'border-aqua/20 bg-aqua/[0.02]' : 'border-ink/[0.06]',
      )}
    >
      {/* Card header */}
      <div
        className="flex cursor-pointer items-center gap-3 p-4"
        onClick={onSelect}
      >
        {/* Icon */}
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${adapter.color}15`, color: adapter.color }}
        >
          <Icon className="h-5 w-5" />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-[14px] font-600 text-ink">{adapter.label}</h3>
            <div className="flex items-center gap-1">
              <span className={statusInfo.dot} style={{ width: 6, height: 6 }} />
              <span className={cn('font-mono text-[9px]', statusInfo.text)}>{statusInfo.label}</span>
            </div>
          </div>
          <p className="font-mono text-[10px] text-dusk mt-0.5">
            {adapter.leadsIngested.toLocaleString()} leads · {adapter.errorRate}% err
          </p>
        </div>

        {/* Toggle */}
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setEnabled(!enabled)}
            className={cn(
              'relative h-5 w-9 rounded-full transition-colors',
              enabled ? 'bg-jade/60' : 'bg-ink/[0.15]',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 h-4 w-4 rounded-full bg-ink transition-transform',
                enabled ? 'translate-x-4' : 'translate-x-0.5',
              )}
            />
          </button>
          <ChevronRight
            className={cn(
              'h-4 w-4 text-dusk transition-transform',
              isActive && 'rotate-90',
            )}
          />
        </div>
      </div>

      {/* Expanded config */}
      {isActive && (
        <div className="border-t border-ink/[0.06] p-4">
          <p className="mb-4 font-mono text-[11px] text-mist leading-relaxed">{adapter.description}</p>
          <AdapterConfig adapterId={adapter.id} color={adapter.color} />
        </div>
      )}
    </div>
  );
}

// ── Per-adapter configs ───────────────────────────────────────────────────────

function AdapterConfig({ adapterId, color }: { adapterId: string; color: string }) {
  if (adapterId === 'linkedin') return <LinkedInConfig color={color} />;
  if (adapterId === 'google_maps') return <GoogleMapsConfig color={color} />;
  if (adapterId === 'csv') return <CSVConfig color={color} />;
  if (adapterId === 'webhook') return <WebhookConfig color={color} />;
  return null;
}

function LinkedInConfig({ color }: { color: string }) {
  const [keywords, setKeywords] = useState('looking for CRM,need sales tool,evaluating software');
  const [maxResults, setMaxResults] = useState(100);
  const [running, setRunning] = useState(false);

  return (
    <div className="space-y-3">
      <FormField label="Search Keywords (comma-separated)">
        <textarea
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          rows={2}
          className="field-input resize-none"
          placeholder="looking for CRM, need automation tool…"
        />
      </FormField>

      <FormField label={`Max Results: ${maxResults}`}>
        <input
          type="range"
          min={10}
          max={500}
          step={10}
          value={maxResults}
          onChange={(e) => setMaxResults(Number(e.target.value))}
          className="w-full accent-[#4A9EF5]"
        />
        <div className="flex justify-between font-mono text-[9px] text-dusk">
          <span>10</span><span>500</span>
        </div>
      </FormField>

      <div className="flex items-center gap-2 rounded-lg border border-gold/15 bg-gold/[0.04] p-2.5">
        <Info className="h-3.5 w-3.5 shrink-0 text-gold" />
        <p className="font-mono text-[10px] text-gold/80">
          Requires active LinkedIn session. Set LINKEDIN_EMAIL + LINKEDIN_PASSWORD in .env
        </p>
      </div>

      <button
        onClick={() => { setRunning(true); setTimeout(() => setRunning(false), 3000); }}
        disabled={running}
        className="flex items-center gap-2 rounded-lg px-4 py-2 font-mono text-[11px] font-500 transition-all disabled:opacity-60"
        style={{ background: `${color}20`, color, border: `1px solid ${color}30` }}
      >
        {running ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
        {running ? 'Scraping…' : 'Trigger Scrape'}
      </button>
    </div>
  );
}

function GoogleMapsConfig({ color }: { color: string }) {
  const [location, setLocation] = useState('New York, NY');
  const [industry, setIndustry] = useState('restaurants');
  const [maxResults, setMaxResults] = useState(50);
  const [running, setRunning] = useState(false);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Location">
          <input value={location} onChange={(e) => setLocation(e.target.value)} className="field-input" placeholder="City, State" />
        </FormField>
        <FormField label="Industry / Business Type">
          <input value={industry} onChange={(e) => setIndustry(e.target.value)} className="field-input" placeholder="restaurants, plumbers…" />
        </FormField>
      </div>

      <FormField label={`Max Results: ${maxResults}`}>
        <input type="range" min={10} max={200} step={10} value={maxResults}
          onChange={(e) => setMaxResults(Number(e.target.value))} className="w-full accent-[#10B981]" />
      </FormField>

      <button
        onClick={() => { setRunning(true); setTimeout(() => setRunning(false), 3000); }}
        disabled={running}
        className="flex items-center gap-2 rounded-lg px-4 py-2 font-mono text-[11px] font-500 transition-all disabled:opacity-60"
        style={{ background: `${color}20`, color, border: `1px solid ${color}30` }}
      >
        {running ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
        {running ? 'Discovering…' : 'Trigger Discovery'}
      </button>
    </div>
  );
}

function CSVConfig({ color }: { color: string }) {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
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
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-orchid" />
            <span className="font-mono text-[12px] text-ink">{file.name}</span>
            <button onClick={(e) => { e.stopPropagation(); setFile(null); }}>
              <X className="h-4 w-4 text-dusk hover:text-crimson" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="h-6 w-6 text-dusk" />
            <div className="text-center">
              <p className="text-[12px] text-mist">Drop CSV or Excel file here</p>
              <p className="font-mono text-[10px] text-dusk">or click to browse</p>
            </div>
          </>
        )}
      </div>

      {file && (
        <div className="rounded-lg border border-orchid/15 bg-orchid/[0.04] p-3">
          <p className="section-label mb-1">Detected Columns</p>
          <div className="flex flex-wrap gap-1.5">
            {['name', 'email', 'company', 'role', 'industry', 'location'].map((col) => (
              <span key={col} className="rounded-md bg-orchid/10 px-2 py-0.5 font-mono text-[10px] text-orchid">{col}</span>
            ))}
          </div>
        </div>
      )}

      <button
        disabled={!file}
        className="flex items-center gap-2 rounded-lg px-4 py-2 font-mono text-[11px] font-500 transition-all disabled:opacity-40"
        style={{ background: `${color}20`, color, border: `1px solid ${color}30` }}
      >
        <Upload className="h-3.5 w-3.5" />
        Import Leads
      </button>
    </div>
  );
}

function WebhookConfig({ color }: { color: string }) {
  const [showKey, setShowKey] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const webhookUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/api/v1/leads`;
  const signingKey = 'whsec_••••••••••••••••••••••••••••••••';

  function copy(text: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(text).then(() => {
      setter(true);
      setTimeout(() => setter(false), 1500);
    });
  }

  return (
    <div className="space-y-3">
      <FormField label="Webhook Endpoint">
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-lg border border-ink/[0.06] bg-elevated px-3 py-2 font-mono text-[11px] text-aqua overflow-x-auto">
            {webhookUrl}
          </code>
          <button
            onClick={() => copy(webhookUrl, setCopiedUrl)}
            className="shrink-0 rounded-lg border border-ink/[0.06] bg-surface p-2 text-dusk hover:text-mist"
          >
            {copiedUrl ? <Check className="h-3.5 w-3.5 text-jade" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </FormField>

      <FormField label="HMAC Signing Key">
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-lg border border-ink/[0.06] bg-elevated px-3 py-2 font-mono text-[11px] text-gold overflow-x-auto">
            {showKey ? 'whsec_abc123xyz789...' : signingKey}
          </code>
          <button onClick={() => setShowKey(!showKey)} className="shrink-0 rounded-lg border border-ink/[0.06] bg-surface p-2 text-dusk hover:text-mist">
            {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
          <button onClick={() => copy('whsec_abc123xyz789...', setCopiedKey)} className="shrink-0 rounded-lg border border-ink/[0.06] bg-surface p-2 text-dusk hover:text-mist">
            {copiedKey ? <Check className="h-3.5 w-3.5 text-jade" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </FormField>

      <div className="rounded-lg border border-ink/[0.06] bg-elevated p-3">
        <p className="section-label mb-2">Payload Schema</p>
        <pre className="font-mono text-[10px] text-mist overflow-x-auto leading-relaxed">
{`POST ${webhookUrl}
{
  "source": "webhook",
  "lead": { "name", "email", "company", "role" },
  "signature": "sha256=<hmac>"
}`}
        </pre>
      </div>
    </div>
  );
}

// ── Shared form components ───────────────────────────────────────────────────

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="section-label">{label}</label>
      {children}
    </div>
  );
}

// Inject field-input style via inline style since Tailwind v4 doesn't support @apply easily
// We set it as a className that maps to the custom utility defined in globals.css

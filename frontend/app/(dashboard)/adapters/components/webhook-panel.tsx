'use client';

import { useState } from 'react';
import { Webhook, Copy, Check, Eye, EyeOff, Play, RefreshCw } from 'lucide-react';
import { cn, relativeTime } from '@/lib/utils';
import { FormField } from './adapter-ui';

// ── Types & constants ──────────────────────────────────────────────────────────

type PayloadFormat = 'leads_array' | 'single_lead' | 'generic_data';

const PAYLOAD_FORMATS: { id: PayloadFormat; label: string }[] = [
  { id: 'leads_array',  label: 'Leads Array' },
  { id: 'single_lead',  label: 'Single Lead' },
  { id: 'generic_data', label: 'Generic Data' },
];

const PAYLOAD_EXAMPLES: Record<PayloadFormat, string> = {
  leads_array: `POST /api/v1/leads/bulk
{
  "source": "webhook",
  "leads": [
    { "name": "Jane Doe", "email": "jane@co.com", "company": "Acme" }
  ],
  "signature": "sha256=<hmac>"
}`,
  single_lead: `POST /api/v1/leads
{
  "source": "webhook",
  "lead": { "name": "John Doe", "email": "john@co.com", "role": "CEO" },
  "signature": "sha256=<hmac>"
}`,
  generic_data: `POST /api/v1/leads
{
  "data": {
    "full_name": "John Doe",
    "email": "john@co.com",
    "job_title": "CEO",
    "organization": "Acme Corp"
  },
  "signature": "sha256=<hmac>"
}`,
};

const MOCK_DELIVERIES = [
  { id: '1', timestamp: new Date(Date.now() - 600_000).toISOString(),    status: 'success' as const, leadCount: 3,  httpStatus: 200 },
  { id: '2', timestamp: new Date(Date.now() - 3_600_000).toISOString(),  status: 'success' as const, leadCount: 1,  httpStatus: 200 },
  { id: '3', timestamp: new Date(Date.now() - 7_200_000).toISOString(),  status: 'failed'  as const, leadCount: 0,  httpStatus: 401 },
  { id: '4', timestamp: new Date(Date.now() - 14_400_000).toISOString(), status: 'success' as const, leadCount: 12, httpStatus: 200 },
];

const FIELD_REFERENCE = [
  { field: 'name',    aliases: 'name, full_name, contact_name' },
  { field: 'email',   aliases: 'email' },
  { field: 'company', aliases: 'company, organization' },
  { field: 'role',    aliases: 'role, title, job_title' },
];

// ── WebhookDetailPanel ─────────────────────────────────────────────────────────

export function WebhookDetailPanel() {
  const [showKey,      setShowKey]     = useState(false);
  const [copiedUrl,    setCopiedUrl]   = useState(false);
  const [copiedKey,    setCopiedKey]   = useState(false);
  const [format,       setFormat]      = useState<PayloadFormat>('leads_array');
  const [testPayload,  setTestPayload] = useState('');
  const [sendingTest,  setSendingTest] = useState(false);

  const webhookUrl  = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/api/v1/leads`;
  const signingKey  = 'whsec_••••••••••••••••••••••••••••••••';
  const revealedKey = 'whsec_abc123xyz789EXAMPLEKEY...';

  function copyToClipboard(text: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(text).then(() => {
      setter(true);
      setTimeout(() => setter(false), 1500);
    });
  }

  return (
    <div className="space-y-5">
      {/* Panel header */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: '#F59E0B15', color: '#F59E0B' }}
        >
          <Webhook className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-display text-[14px] font-600 text-ink">Webhook Adapter</h2>
          <p className="font-mono text-[10px] text-dusk">Receive leads via HMAC-signed HTTP POST</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Left: endpoint config + test sender */}
        <div className="space-y-4">
          {/* Endpoint URL */}
          <FormField label="Webhook Endpoint">
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg border border-ink/[0.06] bg-elevated px-3 py-2 font-mono text-[11px] text-aqua overflow-x-auto">
                {webhookUrl}
              </code>
              <CopyButton copied={copiedUrl} onCopy={() => copyToClipboard(webhookUrl, setCopiedUrl)} />
            </div>
          </FormField>

          {/* HMAC signing key */}
          <FormField label="HMAC Signing Key">
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg border border-ink/[0.06] bg-elevated px-3 py-2 font-mono text-[11px] text-gold overflow-x-auto">
                {showKey ? revealedKey : signingKey}
              </code>
              <button
                onClick={() => setShowKey(!showKey)}
                className="shrink-0 rounded-lg border border-ink/[0.06] bg-surface p-2 text-dusk hover:text-mist"
              >
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
              <CopyButton copied={copiedKey} onCopy={() => copyToClipboard(revealedKey, setCopiedKey)} />
            </div>
          </FormField>

          {/* Payload format */}
          <FormField label="Payload Format">
            <div className="flex flex-wrap gap-1.5">
              {PAYLOAD_FORMATS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setFormat(id)}
                  className={cn(
                    'rounded-md px-2.5 py-1 font-mono text-[10px] border transition-colors',
                    format === id
                      ? 'border-gold/30 bg-gold/10 text-gold'
                      : 'border-ink/[0.06] text-dusk hover:text-mist',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </FormField>

          {/* Example payload */}
          <div className="rounded-lg border border-ink/[0.06] bg-elevated p-3">
            <p className="section-label mb-2">Example Payload</p>
            <pre className="font-mono text-[10px] text-mist overflow-x-auto leading-relaxed whitespace-pre-wrap">
              {PAYLOAD_EXAMPLES[format]}
            </pre>
          </div>

          {/* Test sender */}
          <FormField label="Send Test Payload">
            <textarea
              value={testPayload}
              onChange={(e) => setTestPayload(e.target.value)}
              rows={4}
              className="field-input resize-none font-mono text-[10px]"
              placeholder={`{ "lead": { "name": "Test User", "email": "test@example.com" } }`}
            />
          </FormField>
          <button
            onClick={() => { setSendingTest(true); setTimeout(() => setSendingTest(false), 1500); }}
            disabled={sendingTest || !testPayload.trim()}
            className="flex items-center gap-2 rounded-lg px-4 py-2 font-mono text-[11px] font-500 border border-gold/20 bg-gold/5 text-gold hover:bg-gold/10 transition-colors disabled:opacity-50"
          >
            {sendingTest
              ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Sending…</>
              : <><Play className="h-3.5 w-3.5" /> Send Test</>
            }
          </button>
        </div>

        {/* Right: delivery log + field reference */}
        <div className="space-y-4">
          <DeliveryLog deliveries={MOCK_DELIVERIES} />
          <FieldReferenceTable fields={FIELD_REFERENCE} />
        </div>
      </div>
    </div>
  );
}

// ── CopyButton ─────────────────────────────────────────────────────────────────

function CopyButton({ copied, onCopy }: { copied: boolean; onCopy: () => void }) {
  return (
    <button
      onClick={onCopy}
      className="shrink-0 rounded-lg border border-ink/[0.06] bg-surface p-2 text-dusk hover:text-mist"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-jade" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

// ── DeliveryLog ────────────────────────────────────────────────────────────────

function DeliveryLog({ deliveries }: { deliveries: typeof MOCK_DELIVERIES }) {
  return (
    <div className="rounded-xl border border-ink/[0.06] overflow-hidden">
      <div className="px-3 py-2 border-b border-ink/[0.06] bg-elevated">
        <p className="section-label">Recent Deliveries</p>
      </div>
      <div className="divide-y divide-ink/[0.04]">
        {deliveries.map((d) => (
          <div key={d.id} className="flex items-center gap-3 px-3 py-2">
            <span
              className={d.status === 'success' ? 'dot-live' : 'dot-error'}
              style={{ width: 6, height: 6 }}
            />
            <div className="flex-1 min-w-0">
              <p className="font-mono text-[10px] text-mist">{relativeTime(d.timestamp)}</p>
            </div>
            <span
              className={cn(
                'font-mono text-[10px] rounded-md px-1.5 py-0.5 border',
                d.httpStatus === 200
                  ? 'border-jade/20 bg-jade/10 text-jade'
                  : 'border-crimson/20 bg-crimson/10 text-crimson',
              )}
            >
              {d.httpStatus}
            </span>
            <span className="font-mono text-[10px] text-dusk w-14 text-right">
              {d.leadCount} lead{d.leadCount !== 1 ? 's' : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── FieldReferenceTable ────────────────────────────────────────────────────────

function FieldReferenceTable({ fields }: { fields: { field: string; aliases: string }[] }) {
  return (
    <div className="rounded-xl border border-ink/[0.06] overflow-hidden">
      <div className="px-3 py-2 border-b border-ink/[0.06] bg-elevated">
        <p className="section-label">Accepted Field Names</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-ink/[0.06] bg-elevated">
              <th className="px-3 py-1.5 font-mono text-[9px] text-dusk">Lead Field</th>
              <th className="px-3 py-1.5 font-mono text-[9px] text-dusk">Accepted Names</th>
            </tr>
          </thead>
          <tbody>
            {fields.map(({ field, aliases }) => (
              <tr key={field} className="border-b border-ink/[0.03]">
                <td className="px-3 py-1.5 font-mono text-[10px] text-aqua">{field}</td>
                <td className="px-3 py-1.5 font-mono text-[10px] text-dusk">{aliases}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

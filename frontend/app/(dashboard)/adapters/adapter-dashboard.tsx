'use client';

import { useState } from 'react';
import type { AdapterId } from './components/adapter-types';
import { ADAPTERS } from './components/adapter-types';
import { AdapterStatsRow } from './components/adapter-stats-row';
import { AdapterSelector } from './components/adapter-selector';
import { CSVDetailPanel } from './components/csv-panel';
import { LinkedInDetailPanel } from './components/linkedin-panel';
import { GoogleMapsDetailPanel } from './components/google-maps-panel';
import { WebhookDetailPanel } from './components/webhook-panel';

// ── Detail panel router ────────────────────────────────────────────────────────

function DetailPanel({ adapterId }: { adapterId: AdapterId }) {
  if (adapterId === 'csv')         return <CSVDetailPanel />;
  if (adapterId === 'linkedin')    return <LinkedInDetailPanel />;
  if (adapterId === 'google_maps') return <GoogleMapsDetailPanel />;
  if (adapterId === 'webhook')     return <WebhookDetailPanel />;
  return null;
}

// ── AdapterDashboard ───────────────────────────────────────────────────────────

export function AdapterDashboard() {
  const [selectedAdapter, setSelectedAdapter] = useState<AdapterId>('csv');

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Page header */}
      <div>
        <h1 className="font-display text-xl font-700 text-ink">Adapters</h1>
        <p className="mt-0.5 font-mono text-[11px] text-mist">
          Configure and trigger data source adapters
        </p>
      </div>

      {/* Clickable stats cards — also act as adapter switcher */}
      <AdapterStatsRow
        adapters={ADAPTERS}
        selected={selectedAdapter}
        onSelect={setSelectedAdapter}
      />

      {/* Dropdown + detail panel */}
      <div className="space-y-4">
        <div>
          <p className="section-label mb-1.5">Configure Adapter</p>
          <AdapterSelector selected={selectedAdapter} onChange={setSelectedAdapter} />
        </div>

        <div className="rounded-xl border border-ink/[0.06] bg-surface p-5">
          <DetailPanel adapterId={selectedAdapter} />
        </div>
      </div>
    </div>
  );
}

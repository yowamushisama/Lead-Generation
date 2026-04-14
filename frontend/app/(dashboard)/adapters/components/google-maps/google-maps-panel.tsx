'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Map, Info, Play, RefreshCw } from 'lucide-react';
import { campaigns as campaignsApi } from '@/lib/api-client';
import { FormField, TagInputMulti } from '../adapter-ui';
import { GOOGLE_MAPS_COLOR, GOOGLE_MAPS_DEFAULTS } from './constants';

// ── GoogleMapsDetailPanel ──────────────────────────────────────────────────────

export function GoogleMapsDetailPanel() {
  const [locations,    setLocations]  = useState<string[]>([]);
  const [bizTypes,     setBizTypes]   = useState<string[]>([]);
  const [minRating,    setMinRating]  = useState(GOOGLE_MAPS_DEFAULTS.minRating);
  const [minReviews,   setMinReviews] = useState(GOOGLE_MAPS_DEFAULTS.minReviews);
  const [maxResults,   setMaxResults] = useState(GOOGLE_MAPS_DEFAULTS.maxResults);
  const [campaignId,   setCampaign]   = useState('');
  const [running,      setRunning]    = useState(false);

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns'],
    queryFn:  () => campaignsApi.list(),
  });

  const canTrigger = locations.length > 0 && bizTypes.length > 0;

  return (
    <div className="space-y-4">
      {/* Panel header */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: `${GOOGLE_MAPS_COLOR}15`, color: GOOGLE_MAPS_COLOR }}
        >
          <Map className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-display text-[14px] font-600 text-ink">Google Maps Adapter</h2>
          <p className="font-mono text-[10px] text-mist">Discover local businesses via Google Places API</p>
        </div>
      </div>

      {/* Locations + business types */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TagInputMulti
          label="Target Locations"
          tags={locations}
          onChange={setLocations}
          placeholder="New York, London, San Francisco…"
          accent="jade"
        />
        <TagInputMulti
          label="Business Types"
          tags={bizTypes}
          onChange={setBizTypes}
          placeholder="restaurant, SaaS, plumber, gym…"
          accent="orchid"
        />
      </div>

      {/* Filters row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label={`Min Rating: ${minRating} ★`}>
          <input
            type="range" min={1} max={5} step={0.5} value={minRating}
            onChange={(e) => setMinRating(Number(e.target.value))}
            className="w-full accent-[#10B981]"
          />
          <div className="flex justify-between font-mono text-[9px] text-mist">
            <span>1★</span><span>5★</span>
          </div>
        </FormField>

        <FormField label="Min Review Count">
          <input
            type="number"
            min={0}
            value={minReviews}
            onChange={(e) => setMinReviews(Number(e.target.value))}
            className="field-input"
            placeholder="10"
          />
        </FormField>
      </div>

      <FormField label={`Max Results: ${maxResults}`}>
        <input
          type="range" min={10} max={200} step={10} value={maxResults}
          onChange={(e) => setMaxResults(Number(e.target.value))}
          className="w-full accent-[#10B981]"
        />
        <div className="flex justify-between font-mono text-[9px] text-dusk">
          <span>10</span><span>200</span>
        </div>
      </FormField>

      <FormField label="Assign to Campaign">
        <select
          value={campaignId}
          onChange={(e) => setCampaign(e.target.value)}
          className="field-input"
        >
          <option value="">— None —</option>
          {campaigns.map((c: { id: string; name: string }) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </FormField>

      {/* API key notice */}
      <div className="flex items-center gap-2 rounded-lg border border-gold/15 bg-gold/[0.04] p-2.5">
        <Info className="h-3.5 w-3.5 shrink-0 text-gold" />
        <p className="font-mono text-[10px] text-gold">
          Requires GOOGLE_MAPS_API_KEY in .env. 2-second delay between pages (API requirement).
        </p>
      </div>

      {/* Trigger */}
      <button
        onClick={() => { setRunning(true); setTimeout(() => setRunning(false), 3000); }}
        disabled={running || !canTrigger}
        className="flex items-center gap-2 rounded-lg px-4 py-2 font-mono text-[11px] font-500 transition-all disabled:opacity-60"
        style={{ background: `${GOOGLE_MAPS_COLOR}20`, color: GOOGLE_MAPS_COLOR, border: `1px solid ${GOOGLE_MAPS_COLOR}30` }}
      >
        {running
          ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Discovering…</>
          : <><Play className="h-3.5 w-3.5" /> Trigger Discovery</>
        }
      </button>

      {!canTrigger && (
        <p className="font-mono text-[10px] text-mist">
          Add at least one location and one business type to trigger discovery.
        </p>
      )}
      {/* TODO: wire to POST /api/v1/adapters/google_maps/trigger */}
    </div>
  );
}

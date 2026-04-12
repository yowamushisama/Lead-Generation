'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link2, Info, ShieldAlert, Clock, Globe, Zap, Play, RefreshCw } from 'lucide-react';
import { campaigns as campaignsApi } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { FormField, TagInputMulti, Toggle } from './adapter-ui';

// ── LinkedIn-specific types & constants ────────────────────────────────────────

type LinkedInTab     = 'search' | 'targeting' | 'session' | 'advanced';
type SearchMode      = 'posts_by_keyword' | 'my_connections' | 'company_followers' | 'job_posters';
type SeniorityLevel  = 'c_suite' | 'vp' | 'director' | 'manager' | 'ic';
type ConnectionDegree = '1st' | '2nd' | '3rd';
type CompanySize     = '1-10' | '11-50' | '51-200' | '201-1000' | '1000+';

const LI_TABS: { id: LinkedInTab; label: string }[] = [
  { id: 'search',    label: 'Search Config' },
  { id: 'targeting', label: 'Targeting' },
  { id: 'session',   label: 'Session & Proxy' },
  { id: 'advanced',  label: 'Advanced' },
];

const SEARCH_MODES: { id: SearchMode; label: string }[] = [
  { id: 'posts_by_keyword',  label: 'Posts by Keyword' },
  { id: 'my_connections',    label: 'My Connections' },
  { id: 'company_followers', label: 'Company Followers' },
  { id: 'job_posters',       label: 'Job Posters' },
];

const SENIORITY_LEVELS: { id: SeniorityLevel; label: string }[] = [
  { id: 'c_suite',  label: 'C-Suite' },
  { id: 'vp',       label: 'VP' },
  { id: 'director', label: 'Director' },
  { id: 'manager',  label: 'Manager' },
  { id: 'ic',       label: 'Individual Contributor' },
];

const COMPANY_SIZES: CompanySize[]      = ['1-10', '11-50', '51-200', '201-1000', '1000+'];
const CONNECTION_DEGREES: ConnectionDegree[] = ['1st', '2nd', '3rd'];

function toggleItem<T>(arr: T[], item: T, setArr: (v: T[]) => void) {
  setArr(arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]);
}

// ── LinkedInDetailPanel ────────────────────────────────────────────────────────

export function LinkedInDetailPanel() {
  const [activeTab, setActiveTab] = useState<LinkedInTab>('search');

  // Search state (shared across tabs via props)
  const [searchMode,     setSearchMode]   = useState<SearchMode>('posts_by_keyword');
  const [keywords,       setKeywords]     = useState<string[]>([]);
  const [phraseMatch,    setPhraseMatch]  = useState(false);
  const [minEngagement,  setMinEngagement]= useState(0);

  // Targeting state
  const [seniority,        setSeniority]   = useState<SeniorityLevel[]>([]);
  const [liIndustries,     setIndustries]  = useState<string[]>([]);
  const [liLocations,      setLocations]   = useState<string[]>([]);
  const [connDegrees,      setDegrees]     = useState<ConnectionDegree[]>(['2nd']);
  const [companySizes,     setSizes]       = useState<CompanySize[]>([]);
  const [targetCompanies,  setTargets]     = useState<string[]>([]);
  const [excludedCompanies,setExcluded]    = useState<string[]>([]);

  // Advanced state
  const [maxPerKeyword, setMaxPerKeyword] = useState(50);
  const [requestDelay,  setRequestDelay]  = useState(1500);
  const [maxTotal,      setMaxTotal]      = useState(200);
  const [schedule,      setSchedule]      = useState<'manual' | 'daily'>('manual');
  const [liCampaignId,  setLiCampaign]    = useState('');
  const [running,       setRunning]       = useState(false);

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns'],
    queryFn:  () => campaignsApi.list(),
  });

  return (
    <div className="space-y-4">
      {/* Panel header */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: '#4A9EF515', color: '#4A9EF5' }}>
          <Link2 className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-display text-[14px] font-600 text-ink">LinkedIn Adapter</h2>
          <p className="font-mono text-[10px] text-mist">Playwright stealth scraping with anti-bot detection</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1.5">
        {LI_TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'rounded-md px-3 py-1.5 font-mono text-[10px] transition-colors border',
              activeTab === id
                ? 'border-aqua/30 bg-aqua/10 text-aqua'
                : 'border-ink/[0.06] text-mist hover:text-ink',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search Config */}
      {activeTab === 'search' && (
        <div className="space-y-4">
          <FormField label="Search Mode">
            <div className="flex flex-wrap gap-1.5">
              {SEARCH_MODES.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setSearchMode(id)}
                  className={cn(
                    'rounded-md px-2.5 py-1 font-mono text-[10px] border transition-colors',
                    searchMode === id
                      ? 'border-aqua/30 bg-aqua/10 text-aqua'
                      : 'border-ink/[0.06] text-mist hover:text-ink',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </FormField>

          <TagInputMulti
            label="Keywords"
            tags={keywords}
            onChange={setKeywords}
            placeholder="looking for CRM, need automation tool…"
            accent="aqua"
          />

          <Toggle checked={phraseMatch} onChange={setPhraseMatch} label="Exact phrase match" activeColor="bg-aqua/60" />

          <FormField label={`Min Engagement Score: ${minEngagement}`}>
            <input
              type="range" min={0} max={100} step={5} value={minEngagement}
              onChange={(e) => setMinEngagement(Number(e.target.value))}
              className="w-full accent-[#4A9EF5]"
            />
            <div className="flex justify-between font-mono text-[9px] text-mist">
              <span>0 (any)</span><span>100 (viral)</span>
            </div>
          </FormField>

          <div className="flex items-center gap-2 rounded-lg border border-gold/15 bg-gold/[0.04] p-2.5">
            <Info className="h-3.5 w-3.5 shrink-0 text-gold" />
            <p className="font-mono text-[10px] text-gold">
              Requires active LinkedIn session. Set LINKEDIN_EMAIL + LINKEDIN_PASSWORD in .env
            </p>
          </div>
        </div>
      )}

      {/* Targeting Filters */}
      {activeTab === 'targeting' && (
        <div className="space-y-4">
          <FormField label="Seniority Level">
            <div className="flex flex-wrap gap-1.5">
              {SENIORITY_LEVELS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => toggleItem(seniority, id, setSeniority)}
                  className={cn(
                    'rounded-md px-2.5 py-1 font-mono text-[10px] border transition-colors',
                    seniority.includes(id)
                      ? 'border-orchid/30 bg-orchid/10 text-orchid'
                      : 'border-ink/[0.06] text-mist hover:text-ink',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </FormField>

          <FormField label="Connection Degree">
            <div className="flex gap-1.5">
              {CONNECTION_DEGREES.map((d) => (
                <button
                  key={d}
                  onClick={() => toggleItem(connDegrees, d, setDegrees)}
                  className={cn(
                    'rounded-md px-3 py-1 font-mono text-[10px] border transition-colors',
                    connDegrees.includes(d)
                      ? 'border-aqua/30 bg-aqua/10 text-aqua'
                      : 'border-ink/[0.06] text-mist hover:text-ink',
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </FormField>

          <FormField label="Company Size">
            <div className="flex flex-wrap gap-1.5">
              {COMPANY_SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleItem(companySizes, s, setSizes)}
                  className={cn(
                    'rounded-md px-2.5 py-1 font-mono text-[10px] border transition-colors',
                    companySizes.includes(s)
                      ? 'border-jade/30 bg-jade/10 text-jade'
                      : 'border-ink/[0.06] text-mist hover:text-ink',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </FormField>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TagInputMulti label="Industries"  tags={liIndustries}    onChange={setIndustries}  placeholder="SaaS, Fintech, Healthcare…"       accent="orchid" />
            <TagInputMulti label="Locations"   tags={liLocations}     onChange={setLocations}   placeholder="United States, London, Canada…"   accent="jade" />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TagInputMulti label="Target Companies (whitelist)"   tags={targetCompanies}   onChange={setTargets}  placeholder="Salesforce, HubSpot…"   accent="aqua" />
            <TagInputMulti label="Excluded Companies (blacklist)" tags={excludedCompanies} onChange={setExcluded} placeholder="Competitor Inc…"          accent="crimson" />
          </div>
        </div>
      )}

      {/* Session & Proxy */}
      {activeTab === 'session' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-ink/[0.06] bg-elevated p-4 space-y-3">
            <p className="section-label">Credential Status</p>
            <div className="flex items-center gap-3">
              <span className="dot-idle" style={{ width: 8, height: 8 }} />
              <div>
                <p className="font-mono text-[12px] text-mist">LINKEDIN_EMAIL</p>
                <p className="font-mono text-[10px] text-mist">
                  Not configured — add to .env to enable scraping
                </p>
              </div>
              {/* TODO: wire to GET /api/v1/adapters/linkedin/session */}
            </div>
          </div>

          <div className="rounded-xl border border-ink/[0.06] bg-elevated p-4 space-y-3">
            <p className="section-label">Session Health</p>
            {[
              { icon: Clock, label: 'Last refreshed',   value: 'Never' },
              { icon: Zap,   label: 'Session status',   value: 'Unknown', badge: true },
              { icon: Globe, label: 'Session cache TTL',value: '12 hours (Redis)' },
            ].map(({ icon: Icon, label, value, badge }) => (
              <div key={label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-dusk" />
                  <span className="font-mono text-[11px] text-mist">{label}</span>
                </div>
                {badge ? (
                  <span className="rounded-md border border-mist/20 bg-mist/10 px-2 py-0.5 font-mono text-[10px] text-mist">
                    {value}
                  </span>
                ) : (
                  <span className="font-mono text-[11px] text-mist">{value}</span>
                )}
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-ink/[0.06] bg-elevated p-4 space-y-3">
            <p className="section-label">Proxy Pool</p>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] text-mist">Active proxies</span>
              <span className="font-mono text-[11px] text-mist">0 configured</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] text-mist">Rotation strategy</span>
              <span className="font-mono text-[11px] text-mist">On CAPTCHA detection</span>
            </div>
            <p className="font-mono text-[10px] text-mist leading-relaxed">
              Configure proxies via PROXY_LIST env var to enable automatic rotation.
            </p>
          </div>

          <button className="flex items-center gap-2 rounded-lg px-4 py-2 font-mono text-[11px] font-500 border border-crimson/20 bg-crimson/5 text-crimson hover:bg-crimson/10 transition-colors">
            <ShieldAlert className="h-3.5 w-3.5" />
            Force Re-Authentication
          </button>
          {/* TODO: wire to POST /api/v1/adapters/linkedin/session/refresh */}
        </div>
      )}

      {/* Advanced Settings */}
      {activeTab === 'advanced' && (
        <div className="space-y-4">
          <FormField label={`Max Results per Keyword: ${maxPerKeyword}`}>
            <input type="range" min={10} max={200} step={5} value={maxPerKeyword}
              onChange={(e) => setMaxPerKeyword(Number(e.target.value))} className="w-full accent-[#4A9EF5]" />
            <div className="flex justify-between font-mono text-[9px] text-mist"><span>10</span><span>200</span></div>
          </FormField>

          <FormField label={`Request Delay: ${requestDelay}ms`}>
            <input type="range" min={800} max={5000} step={100} value={requestDelay}
              onChange={(e) => setRequestDelay(Number(e.target.value))} className="w-full accent-[#F59E0B]" />
            <div className="flex justify-between font-mono text-[9px] text-mist"><span>800ms (fast)</span><span>5000ms (safe)</span></div>
          </FormField>

          <FormField label={`Max Total Results: ${maxTotal}`}>
            <input type="range" min={10} max={1000} step={10} value={maxTotal}
              onChange={(e) => setMaxTotal(Number(e.target.value))} className="w-full accent-[#4A9EF5]" />
            <div className="flex justify-between font-mono text-[9px] text-mist"><span>10</span><span>1,000</span></div>
          </FormField>

          <FormField label="Run Schedule">
            <div className="flex gap-1.5">
              {(['manual', 'daily'] as const).map((s) => (
                <button key={s} onClick={() => setSchedule(s)}
                  className={cn(
                    'rounded-md px-3 py-1.5 font-mono text-[10px] border transition-colors',
                    schedule === s ? 'border-aqua/30 bg-aqua/10 text-aqua' : 'border-ink/[0.06] text-dusk hover:text-mist',
                  )}
                >
                  {s === 'manual' ? 'Manual only' : 'Daily auto (8AM)'}
                </button>
              ))}
            </div>
          </FormField>

          <FormField label="Assign to Campaign">
            <select value={liCampaignId} onChange={(e) => setLiCampaign(e.target.value)} className="field-input">
              <option value="">— None —</option>
              {campaigns.map((c: { id: string; name: string }) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </FormField>

          <button
            onClick={() => { setRunning(true); setTimeout(() => setRunning(false), 3000); }}
            disabled={running || keywords.length === 0}
            className="flex items-center gap-2 rounded-lg px-4 py-2 font-mono text-[11px] font-500 transition-all disabled:opacity-60"
            style={{ background: '#4A9EF520', color: '#4A9EF5', border: '1px solid #4A9EF530' }}
          >
            {running
              ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Scraping…</>
              : <><Play className="h-3.5 w-3.5" /> Trigger Scrape</>
            }
          </button>
          {keywords.length === 0 && (
            <p className="font-mono text-[10px] text-mist">
              Add at least one keyword in Search Config to trigger scraping.
            </p>
          )}
          {/* TODO: wire to POST /api/v1/adapters/linkedin/trigger */}
        </div>
      )}
    </div>
  );
}

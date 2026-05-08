import { cn } from '@/lib/utils';
import type { ScoringBreakdown, LeadTier } from '@/models';

function tierColor(tier: LeadTier | null | undefined) {
  if (tier === 'HOT') return 'bg-gold';
  if (tier === 'WARM') return 'bg-tangerine';
  return 'bg-aqua';
}

function tierTrack(tier: LeadTier | null | undefined) {
  if (tier === 'HOT') return 'bg-gold/10';
  if (tier === 'WARM') return 'bg-tangerine/10';
  return 'bg-aqua/10';
}

export function ScoreBar({
  score,
  tier,
  size = 'md',
  showLabel = true,
}: {
  score: number | null;
  tier?: LeadTier | null;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}) {
  const pct = Math.min(Math.max(score ?? 0, 0), 100);

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'relative overflow-hidden rounded-full',
          tierTrack(tier),
          size === 'sm' ? 'h-1 w-16' : 'h-1.5 w-24',
        )}
      >
        <div
          className={cn('h-full rounded-full transition-all duration-500', tierColor(tier))}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className={cn('num font-mono font-500', size === 'sm' ? 'text-[10px]' : 'text-xs', tierColor(tier).replace('bg-', 'text-'))}>
          {score ?? '—'}
        </span>
      )}
    </div>
  );
}

// ── Full breakdown ───────────────────────────────────────────────────────────

const FACTOR_COLORS: Record<string, string> = {
  intent:   'bg-gold',
  urgency:  'bg-crimson',
  role:     'bg-orchid',
  recency:  'bg-aqua',
  budget:   'bg-jade',
  icp:      'bg-tangerine',
  negative: 'bg-rose',
  digital:  'bg-aqua',
  gap:      'bg-aqua',
};

function factorColor(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, color] of Object.entries(FACTOR_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return 'bg-mist';
}

export function ScoreBreakdown({ breakdown }: { breakdown: ScoringBreakdown }) {
  const sumMaxPossible = breakdown.factors.reduce((sum, f) => sum + f.maxPossible, 0);

  return (
    <div className="space-y-2">
      {/* Overall — normalized % (primary) + raw pts (secondary) */}
      <div className="flex items-center justify-between mb-3">
        <span className="section-label">Score Breakdown</span>
        <div className="text-right">
          <p className="num font-mono text-sm font-600 text-ink">
            {(breakdown.normalizedScore ?? breakdown.totalScore).toFixed(1)}%
          </p>
          <p className="font-mono text-[10px] text-dusk">
            {breakdown.totalScore} of {sumMaxPossible} pts
          </p>
        </div>
      </div>

      {/* Factor bars */}
      {breakdown.factors.map((factor) => {
        const pct = factor.maxPossible > 0
          ? Math.min((factor.score / factor.maxPossible) * 100, 100)
          : 0;
        return (
          <div key={factor.name} className="group">
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-mist">
                {factor.name}
              </span>
              <span className="num font-mono text-[10px] text-ink">
                {factor.score}/{factor.maxPossible}
              </span>
            </div>
            <div className="relative h-1 w-full rounded-full bg-ink/[0.06]">
              <div
                className={cn('h-full rounded-full transition-all duration-500', factorColor(factor.name))}
                style={{ width: `${pct}%` }}
              />
            </div>
            {factor.reasoning && (
              <p className="mt-0.5 hidden text-[11px] text-mist leading-relaxed group-hover:block">
                {factor.reasoning}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

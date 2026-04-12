import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

type Accent = 'gold' | 'aqua' | 'orchid' | 'jade' | 'crimson' | 'tangerine';

const ACCENT_STYLES: Record<Accent, { icon: string; value: string; bg: string; ring: string }> = {
  gold:       { icon: 'text-gold bg-gold/10',       value: 'text-gradient-gold',  bg: 'bg-gold/[0.03]',       ring: 'border-gold/15' },
  aqua:       { icon: 'text-aqua bg-aqua/10',       value: 'text-aqua',           bg: 'bg-aqua/[0.03]',       ring: 'border-aqua/15' },
  orchid:     { icon: 'text-orchid bg-orchid/10',   value: 'text-orchid',         bg: 'bg-orchid/[0.03]',     ring: 'border-orchid/15' },
  jade:       { icon: 'text-jade bg-jade/10',       value: 'text-jade',           bg: 'bg-jade/[0.03]',       ring: 'border-jade/15' },
  crimson:    { icon: 'text-crimson bg-crimson/10', value: 'text-crimson',        bg: 'bg-crimson/[0.03]',    ring: 'border-crimson/15' },
  tangerine:  { icon: 'text-tangerine bg-tangerine/10', value: 'text-tangerine',  bg: 'bg-tangerine/[0.03]',  ring: 'border-tangerine/15' },
};

export function StatCard({
  label,
  value,
  subLabel,
  trend,
  trendUp,
  icon: Icon,
  accent = 'aqua',
  loading = false,
  className,
}: {
  label: string;
  value: string | number;
  subLabel?: string;
  trend?: string;
  trendUp?: boolean;
  icon?: LucideIcon;
  accent?: Accent;
  loading?: boolean;
  className?: string;
}) {
  const styles = ACCENT_STYLES[accent];

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border bg-surface p-4 transition-all duration-200 hover:bg-elevated',
        styles.ring,
        styles.bg,
        className,
      )}
    >
      {/* Background gradient hint */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          background: `radial-gradient(ellipse at top right, var(--color-${accent})/0.08, transparent 70%)`,
        }}
      />

      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="section-label mb-2">{label}</p>

          {loading ? (
            <div className="skeleton h-8 w-20 rounded-md" />
          ) : (
            <p className={cn('num font-display text-2xl font-700 leading-none', styles.value)}>
              {value}
            </p>
          )}

          <div className="mt-2 flex items-center gap-2">
            {trend && (
              <span
                className={cn(
                  'flex items-center gap-0.5 font-mono text-[11px]',
                  trendUp === true && 'text-jade',
                  trendUp === false && 'text-crimson',
                  trendUp === undefined && 'text-mist',
                )}
              >
                {trendUp === true && <TrendingUp className="h-3 w-3" />}
                {trendUp === false && <TrendingDown className="h-3 w-3" />}
                {trendUp === undefined && <Minus className="h-3 w-3" />}
                {trend}
              </span>
            )}
            {subLabel && (
              <span className="font-mono text-[11px] text-mist">{subLabel}</span>
            )}
          </div>
        </div>

        {Icon && (
          <div className={cn('rounded-lg p-2 shrink-0', styles.icon)}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
    </div>
  );
}

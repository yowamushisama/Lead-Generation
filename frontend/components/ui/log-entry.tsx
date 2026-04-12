import { cn } from '@/lib/utils';
import type { DiagnosticLog } from '@/models';

const LEVEL_STYLES = {
  INFO:  { cls: 'text-aqua bg-aqua/5',    dot: 'bg-aqua',    label: 'INFO' },
  WARN:  { cls: 'text-gold bg-gold/5',    dot: 'bg-gold',    label: 'WARN' },
  ERROR: { cls: 'text-crimson bg-crimson/5', dot: 'bg-crimson', label: 'ERR' },
  DEBUG: { cls: 'text-dusk bg-dusk/5',    dot: 'bg-dusk',    label: 'DBG' },
};

export function LogEntry({
  log,
  compact = false,
}: {
  log: DiagnosticLog;
  compact?: boolean;
}) {
  const styles = LEVEL_STYLES[log.level] ?? LEVEL_STYLES.INFO;
  const time = new Date(log.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-md px-3 transition-colors hover:bg-ink/[0.03]',
        compact ? 'py-1' : 'py-1.5',
      )}
    >
      {/* Level indicator */}
      <span
        className={cn(
          'mt-0.5 shrink-0 rounded px-1 py-0.5 font-mono text-[9px] font-600 uppercase tracking-wider',
          styles.cls,
        )}
      >
        {styles.label}
      </span>

      {/* Timestamp */}
      <span className="shrink-0 font-mono text-[10px] text-dusk">{time}</span>

      {/* Message */}
      <span className="min-w-0 flex-1 font-mono text-[11px] text-mist leading-relaxed break-all">
        {log.stage && (
          <span className="mr-1.5 text-orchid">[{log.stage}]</span>
        )}
        {log.message}
        {log.leadId && (
          <span className="ml-1.5 text-dusk">#{log.leadId.slice(0, 8)}</span>
        )}
      </span>
    </div>
  );
}

// ── Log level legend ─────────────────────────────────────────────────────────

export function LogLegend() {
  return (
    <div className="flex items-center gap-3">
      {Object.entries(LEVEL_STYLES).map(([level, s]) => (
        <div key={level} className="flex items-center gap-1">
          <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
          <span className="font-mono text-[10px] text-dusk">{level}</span>
        </div>
      ))}
    </div>
  );
}

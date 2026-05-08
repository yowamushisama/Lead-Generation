import { cn } from '@/lib/utils';

export function Card({
  id,
  className,
  children,
  glow,
  accent,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
  glow?: 'gold' | 'aqua' | 'orchid' | 'jade' | 'crimson';
  accent?: boolean;
}) {
  return (
    <div
      id={id}
      className={cn(
        'rounded-xl border border-ink/[0.06] bg-surface p-4',
        glow === 'gold' && 'ring-glow-gold',
        glow === 'aqua' && 'ring-glow-aqua',
        glow === 'jade' && 'ring-glow-jade',
        glow === 'crimson' && 'ring-glow-crimson',
        accent && 'border-gold/20 bg-gold/[0.02]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('mb-3 flex items-center justify-between', className)}>
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <h3 className={cn('font-display text-[13px] font-600 text-ink', className)}>
      {children}
    </h3>
  );
}

export function CardLabel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <p className={cn('section-label', className)}>{children}</p>;
}

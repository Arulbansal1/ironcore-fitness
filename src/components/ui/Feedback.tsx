'use client';

import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type AlertTone = 'info' | 'success' | 'warning' | 'error';

const ALERT_STYLES: Record<AlertTone, { wrap: string; icon: ReactNode }> = {
  info: {
    wrap: 'bg-sky-50 text-sky-900 border-sky-200 dark:bg-sky-500/10 dark:text-sky-200 dark:border-sky-500/30',
    icon: <Info className="h-4 w-4" aria-hidden />,
  },
  success: {
    wrap: 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:border-emerald-500/30',
    icon: <CheckCircle2 className="h-4 w-4" aria-hidden />,
  },
  warning: {
    wrap: 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/30',
    icon: <AlertTriangle className="h-4 w-4" aria-hidden />,
  },
  error: {
    wrap: 'bg-red-50 text-red-900 border-red-200 dark:bg-red-500/10 dark:text-red-200 dark:border-red-500/30',
    icon: <XCircle className="h-4 w-4" aria-hidden />,
  },
};

export function Alert({
  tone = 'info',
  title,
  children,
  className,
  action,
}: {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  const style = ALERT_STYLES[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm', style.wrap, className)}
    >
      <span className="mt-0.5 shrink-0">{style.icon}</span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn('text-sm', title && 'mt-0.5 opacity-90')}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted" role="status">
      <Loader2 className={cn('h-4 w-4 animate-spin', className)} aria-hidden />
      {label && <span>{label}</span>}
    </span>
  );
}

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[240px] items-center justify-center">
      <Spinner label={label} />
    </div>
  );
}

export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2.5', className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="skeleton h-14 w-full" />
      ))}
    </div>
  );
}

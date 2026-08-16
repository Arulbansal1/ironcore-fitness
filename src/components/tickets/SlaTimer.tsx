'use client';

import { CheckCircle2, Clock, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

export type SlaClockData = {
  label: string;
  startedAt: string | null;
  dueAt: string | null;
  metAt: string | null;
  remainingMs: number | null;
  breached: boolean;
  elapsedPercent: number;
  state: 'met' | 'ok' | 'at_risk' | 'breached' | 'none';
};

const STATE_STYLES: Record<SlaClockData['state'], { text: string; bar: string }> = {
  met: { text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500' },
  ok: { text: 'text-ink', bar: 'bg-brand-500' },
  at_risk: { text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500' },
  breached: { text: 'text-red-600 dark:text-red-400', bar: 'bg-red-500' },
  none: { text: 'text-muted', bar: 'bg-line' },
};

function formatRemaining(ms: number): string {
  const abs = Math.abs(ms);
  const seconds = Math.floor(abs / 1000) % 60;
  const minutes = Math.floor(abs / 60_000) % 60;
  const hours = Math.floor(abs / 3_600_000) % 24;
  const days = Math.floor(abs / 86_400_000);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
}

type Computed = {
  state: SlaClockData['state'];
  remainingMs: number;
  percent: number;
  overdue: boolean;
};

function compute(clock: SlaClockData, now: number): Computed {
  if (!clock.dueAt || clock.state === 'none') {
    return { state: 'none', remainingMs: 0, percent: 0, overdue: false };
  }

  const due = new Date(clock.dueAt).getTime();
  const started = clock.startedAt ? new Date(clock.startedAt).getTime() : due;
  const windowMs = Math.max(due - started, 1);

  // A stopped clock keeps whatever the server computed.
  if (clock.metAt) {
    return {
      state: clock.state,
      remainingMs: clock.remainingMs ?? 0,
      percent: clock.elapsedPercent,
      overdue: clock.breached,
    };
  }

  const remainingMs = due - now;
  const percent = Math.min(100, Math.max(0, ((now - started) / windowMs) * 100));
  const overdue = remainingMs <= 0;

  return {
    state: overdue ? 'breached' : percent >= 75 ? 'at_risk' : 'ok',
    remainingMs,
    percent,
    overdue,
  };
}

/**
 * Live SLA countdown. The server sends absolute deadlines; the browser ticks
 * locally so the number moves every second without hitting the API.
 */
export function SlaTimer({ clock, compact }: { clock: SlaClockData; compact?: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  const running = !clock.metAt && clock.state !== 'none';

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [running]);

  if (clock.state === 'none') {
    return <span className="text-xs text-muted">No SLA target</span>;
  }

  const { state, remainingMs, percent, overdue } = compute(clock, now);
  const style = STATE_STYLES[state];
  const Icon = state === 'met' ? CheckCircle2 : state === 'breached' ? TriangleAlert : Clock;

  const statusText = clock.metAt
    ? clock.breached
      ? 'Met late'
      : 'Met on time'
    : overdue
      ? `Overdue by ${formatRemaining(remainingMs)}`
      : `${formatRemaining(remainingMs)} left`;

  if (compact) {
    return (
      <span
        className={cn('inline-flex items-center gap-1 text-xs font-medium tabular-nums', style.text)}
        title={`${clock.label}: ${statusText}`}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {clock.metAt ? (clock.breached ? 'Late' : 'Met') : overdue ? `${formatRemaining(remainingMs)} over` : formatRemaining(remainingMs)}
      </span>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-muted">{clock.label}</span>
        <span className={cn('inline-flex items-center gap-1 text-xs font-semibold tabular-nums', style.text)}>
          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {statusText}
        </span>
      </div>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${clock.label} SLA progress`}
      >
        <div
          className={cn('h-full rounded-full transition-all duration-700', style.bar)}
          style={{ width: `${Math.max(3, percent)}%` }}
        />
      </div>
      {clock.dueAt && (
        <p className="mt-1 text-[11px] text-muted">
          Target{' '}
          {new Date(clock.dueAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
      )}
    </div>
  );
}

export function SlaSummary({
  sla,
}: {
  sla: { firstResponse: SlaClockData; resolution: SlaClockData };
}) {
  return (
    <div className="space-y-3.5">
      <SlaTimer clock={sla.firstResponse} />
      <SlaTimer clock={sla.resolution} />
    </div>
  );
}

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type Tone =
  | 'neutral'
  | 'brand'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'purple';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted ring-line',
  brand: 'bg-brand-50 text-brand-700 ring-brand-500/25',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300',
  warning: 'bg-amber-50 text-amber-700 ring-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300',
  danger: 'bg-red-50 text-red-700 ring-red-500/25 dark:bg-red-500/10 dark:text-red-300',
  info: 'bg-sky-50 text-sky-700 ring-sky-500/25 dark:bg-sky-500/10 dark:text-sky-300',
  purple: 'bg-violet-50 text-violet-700 ring-violet-500/25 dark:bg-violet-500/10 dark:text-violet-300',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
  dot,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

// --- domain-specific badges ------------------------------------------------

const STATUS_TONE: Record<string, Tone> = {
  OPEN: 'info',
  IN_PROGRESS: 'brand',
  PENDING_MEMBER: 'warning',
  RESOLVED: 'success',
  CLOSED: 'neutral',
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  PENDING_MEMBER: 'Pending member',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge tone={STATUS_TONE[status] ?? 'neutral'} className={className} dot>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

const PRIORITY_TONE: Record<string, Tone> = {
  LOW: 'neutral',
  MEDIUM: 'info',
  HIGH: 'warning',
  URGENT: 'danger',
};

export function PriorityBadge({ priority, className }: { priority: string; className?: string }) {
  return (
    <Badge tone={PRIORITY_TONE[priority] ?? 'neutral'} className={className}>
      {priority.charAt(0) + priority.slice(1).toLowerCase()}
    </Badge>
  );
}

const SENTIMENT_TONE: Record<string, Tone> = {
  POSITIVE: 'success',
  NEUTRAL: 'neutral',
  NEGATIVE: 'warning',
  FRUSTRATED: 'danger',
};

const SENTIMENT_EMOJI: Record<string, string> = {
  POSITIVE: '🙂',
  NEUTRAL: '😐',
  NEGATIVE: '🙁',
  FRUSTRATED: '😠',
};

export function SentimentBadge({ sentiment, className }: { sentiment: string; className?: string }) {
  return (
    <Badge tone={SENTIMENT_TONE[sentiment] ?? 'neutral'} className={className}>
      <span aria-hidden>{SENTIMENT_EMOJI[sentiment] ?? ''}</span>
      {sentiment.charAt(0) + sentiment.slice(1).toLowerCase()}
    </Badge>
  );
}

export function CategoryBadge({ category, className }: { category: string; className?: string }) {
  return (
    <Badge tone="purple" className={className}>
      {category
        .split('_')
        .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
        .join(' ')}
    </Badge>
  );
}

/** Colour-graded AI confidence chip. */
export function ConfidenceBadge({ value, className }: { value: number; className?: string }) {
  const percent = Math.round(value * 100);
  const tone: Tone = percent >= 75 ? 'success' : percent >= 50 ? 'warning' : 'danger';
  return (
    <Badge tone={tone} className={className}>
      {percent}% confidence
    </Badge>
  );
}

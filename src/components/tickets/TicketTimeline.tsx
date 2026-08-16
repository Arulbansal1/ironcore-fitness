import {
  ArrowRightLeft,
  Bot,
  CheckCircle2,
  FilePlus2,
  MessageSquare,
  Paperclip,
  Play,
  RotateCcw,
  Sparkles,
  Star,
  TriangleAlert,
  UserCheck,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { formatDateTime, relativeTime } from '@/lib/utils';

export type TimelineEvent = {
  id: string;
  type: string;
  summary: string;
  fromValue: string | null;
  toValue: string | null;
  createdAt: string | Date;
  actor: { id: string; name: string; role: string } | null;
};

const ICONS: Record<string, { icon: ReactNode; tint: string }> = {
  created: { icon: <FilePlus2 className="h-3.5 w-3.5" />, tint: 'bg-brand-50 text-brand-600' },
  ai_triaged: { icon: <Bot className="h-3.5 w-3.5" />, tint: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15' },
  ai_suggested: { icon: <Sparkles className="h-3.5 w-3.5" />, tint: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15' },
  assigned: { icon: <UserCheck className="h-3.5 w-3.5" />, tint: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15' },
  status_changed: { icon: <ArrowRightLeft className="h-3.5 w-3.5" />, tint: 'bg-surface-2 text-muted' },
  priority_changed: { icon: <ArrowRightLeft className="h-3.5 w-3.5" />, tint: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15' },
  category_changed: { icon: <ArrowRightLeft className="h-3.5 w-3.5" />, tint: 'bg-surface-2 text-muted' },
  first_response: { icon: <Play className="h-3.5 w-3.5" />, tint: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15' },
  escalated: { icon: <TriangleAlert className="h-3.5 w-3.5" />, tint: 'bg-red-100 text-red-600 dark:bg-red-500/15' },
  attachment_added: { icon: <Paperclip className="h-3.5 w-3.5" />, tint: 'bg-surface-2 text-muted' },
  reopened: { icon: <RotateCcw className="h-3.5 w-3.5" />, tint: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15' },
  rated: { icon: <Star className="h-3.5 w-3.5" />, tint: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15' },
  resolved: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, tint: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15' },
  ai_reviewed: { icon: <Sparkles className="h-3.5 w-3.5" />, tint: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15' },
};

const FALLBACK = { icon: <MessageSquare className="h-3.5 w-3.5" />, tint: 'bg-surface-2 text-muted' };

/** Complete, append-only activity history for a ticket. */
export function TicketTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-muted">No activity recorded yet.</p>;
  }

  return (
    <ol className="relative space-y-4 px-4 py-4 sm:px-5">
      {events.map((event, index) => {
        const style = ICONS[event.type] ?? FALLBACK;
        const isLast = index === events.length - 1;

        return (
          <li key={event.id} className="relative flex gap-3">
            {!isLast && (
              <span className="absolute left-[13px] top-7 h-[calc(100%+4px)] w-px bg-line" aria-hidden />
            )}
            <span
              className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${style.tint}`}
              aria-hidden
            >
              {style.icon}
            </span>
            <div className="min-w-0 flex-1 pb-1">
              <p className="text-sm leading-snug text-ink">{event.summary}</p>
              <p className="mt-0.5 text-xs text-muted">
                {event.actor ? `${event.actor.name} · ` : ''}
                <time dateTime={new Date(event.createdAt).toISOString()} title={formatDateTime(event.createdAt)}>
                  {relativeTime(event.createdAt)}
                </time>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

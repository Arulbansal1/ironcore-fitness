'use client';

import { BellOff, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Spinner } from '@/components/ui/Feedback';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { cn, relativeTime } from '@/lib/utils';

type Notification = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  level: 'info' | 'warning' | 'critical';
  readAt: string | null;
  createdAt: string;
};

const LEVEL_DOT: Record<string, string> = {
  info: 'bg-sky-500',
  warning: 'bg-amber-500',
  critical: 'bg-red-500',
};

export function NotificationPanel({
  onClose,
  onUnreadChange,
}: {
  onClose: () => void;
  onUnreadChange: (count: number) => void;
}) {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<{ notifications: Notification[]; unread: number }>(
          '/api/notifications',
        );
        if (cancelled) return;
        setItems(data.notifications);
        onUnreadChange(data.unread);
      } catch (caught) {
        if (!cancelled) setError(errorMessage(caught, 'Could not load notifications.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onUnreadChange]);

  async function markAllRead() {
    setMarking(true);
    try {
      await apiFetch('/api/notifications', { method: 'PATCH', body: { action: 'mark_all_read' } });
      setItems((current) => current.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
      onUnreadChange(0);
    } catch (caught) {
      setError(errorMessage(caught, 'Could not mark notifications as read.'));
    } finally {
      setMarking(false);
    }
  }

  const unreadCount = items.filter((n) => !n.readAt).length;

  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} aria-hidden />
      <div className="absolute right-0 z-20 mt-2 w-[min(22rem,calc(100vw-2rem))] animate-fade-in overflow-hidden rounded-xl border border-line bg-surface shadow-pop">
        <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
          <p className="text-sm font-semibold text-ink">Notifications</p>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              disabled={marking}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline disabled:opacity-60"
            >
              <CheckCheck className="h-3.5 w-3.5" aria-hidden />
              Mark all read
            </button>
          )}
        </div>

        <div className="scrollbar-thin max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner label="Loading…" />
            </div>
          ) : error ? (
            <p className="px-3.5 py-6 text-center text-sm text-red-600">{error}</p>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-3.5 py-8 text-center">
              <BellOff className="h-6 w-6 text-muted" aria-hidden />
              <p className="text-sm text-muted">You&apos;re all caught up.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {items.map((item) => {
                const content = (
                  <div className={cn('flex gap-2.5 px-3.5 py-3', !item.readAt && 'bg-brand-50/40')}>
                    <span
                      className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', LEVEL_DOT[item.level])}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">{item.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted">{item.body}</p>
                      <p className="mt-1 text-[11px] text-muted">{relativeTime(item.createdAt)}</p>
                    </div>
                  </div>
                );

                return (
                  <li key={item.id}>
                    {item.link ? (
                      <Link href={item.link} onClick={onClose} className="block transition-colors hover:bg-surface-2">
                        {content}
                      </Link>
                    ) : (
                      content
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

'use client';

import { CheckCircle2, History, MessagesSquare, Paperclip, RotateCcw, Star, Timer } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Conversation, type ConversationMessage } from '@/components/tickets/Conversation';
import { SlaSummary, type SlaClockData } from '@/components/tickets/SlaTimer';
import { TicketTimeline, type TimelineEvent } from '@/components/tickets/TicketTimeline';
import {
  CategoryBadge,
  PriorityBadge,
  SentimentBadge,
  StatusBadge,
} from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { cn, formatBytes, formatDateTime, initials, relativeTime } from '@/lib/utils';

type Ticket = {
  id: string;
  number: number;
  subject: string;
  body: string;
  status: string;
  priority: string;
  category: string;
  aiSummary: string | null;
  aiSentiment: string | null;
  satisfaction: number | null;
  createdAt: string;
  updatedAt: string;
  assignee: { id: string; name: string; email: string; avatarColor: string } | null;
  slaPolicyName: string | null;
  sla: { firstResponse: SlaClockData; resolution: SlaClockData; worstState: string };
};

type Attachment = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploader: { name: string } | null;
};

export function MemberTicketView({
  ticket,
  messages,
  events,
  attachments,
  currentUserId,
}: {
  ticket: Ticket;
  messages: ConversationMessage[];
  events: TimelineEvent[];
  attachments: Attachment[];
  currentUserId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<'conversation' | 'history' | 'files'>('conversation');
  const [confirmClose, setConfirmClose] = useState(false);
  const [working, setWorking] = useState(false);
  const [rating, setRating] = useState<number | null>(ticket.satisfaction);
  const [hoverRating, setHoverRating] = useState(0);

  const isClosed = ticket.status === 'CLOSED';
  const isResolved = ticket.status === 'RESOLVED' || isClosed;

  async function changeStatus(status: 'CLOSED' | 'OPEN') {
    setWorking(true);
    try {
      await apiFetch(`/api/tickets/${ticket.id}`, { method: 'PATCH', body: { status } });
      toast.success(status === 'CLOSED' ? 'Ticket closed.' : 'Ticket reopened.');
      setConfirmClose(false);
      router.refresh();
    } catch (caught) {
      toast.error('Could not update the ticket', errorMessage(caught));
    } finally {
      setWorking(false);
    }
  }

  async function submitRating(value: number) {
    setWorking(true);
    try {
      await apiFetch(`/api/tickets/${ticket.id}/rate`, { method: 'POST', body: { rating: value } });
      setRating(value);
      toast.success('Thanks for the feedback.');
      router.refresh();
    } catch (caught) {
      toast.error('Could not save your rating', errorMessage(caught));
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <div className="border-b border-line px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xs text-muted">Ticket #{ticket.number}</p>
                <h1 className="mt-1 text-lg font-semibold leading-snug text-ink">{ticket.subject}</h1>
                <p className="mt-1 text-xs text-muted">
                  Opened {relativeTime(ticket.createdAt)} · Last activity {relativeTime(ticket.updatedAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
                <CategoryBadge category={ticket.category} />
              </div>
            </div>

            {ticket.aiSummary && (
              <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2.5 text-sm leading-relaxed text-muted">
                <span className="font-medium text-ink">Summary: </span>
                {ticket.aiSummary}
              </p>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-line px-2 py-1.5 sm:px-3">
            {[
              { id: 'conversation' as const, label: 'Conversation', icon: MessagesSquare, count: messages.length },
              { id: 'history' as const, label: 'History', icon: History, count: events.length },
              { id: 'files' as const, label: 'Files', icon: Paperclip, count: attachments.length },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  tab === item.id ? 'bg-brand-50 text-brand-700' : 'text-muted hover:bg-surface-2 hover:text-ink',
                )}
              >
                <item.icon className="h-4 w-4" aria-hidden />
                {item.label}
                {item.count > 0 && <span className="text-xs opacity-70">{item.count}</span>}
              </button>
            ))}
          </div>

          {tab === 'conversation' && (
            <Conversation
              ticketId={ticket.id}
              initialMessages={messages}
              currentUserId={currentUserId}
              canPostInternalNote={false}
              disabled={isClosed}
              disabledReason="This ticket is closed. Reopen it to add another reply."
              onMessageSent={() => router.refresh()}
            />
          )}

          {tab === 'history' && <TicketTimeline events={events} />}

          {tab === 'files' && (
            <div className="px-4 py-4 sm:px-5">
              {attachments.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">
                  No files attached. You can add files from the conversation tab.
                </p>
              ) : (
                <ul className="space-y-2">
                  {attachments.map((attachment) => (
                    <li key={attachment.id}>
                      <a
                        href={`/api/attachments/${attachment.id}?download=1`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5 transition-colors hover:border-brand-500/60 hover:bg-surface-2/50"
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <Paperclip className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-ink">
                              {attachment.filename}
                            </span>
                            <span className="block text-xs text-muted">
                              {formatBytes(attachment.sizeBytes)} · uploaded by{' '}
                              {attachment.uploader?.name ?? 'unknown'} · {relativeTime(attachment.createdAt)}
                            </span>
                          </span>
                        </span>
                        <span className="shrink-0 text-xs font-medium text-brand-600">Download</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        <Card>
          <CardHeader
            title="Service level"
            icon={<Timer className="h-4 w-4" />}
            description={ticket.slaPolicyName ?? 'Default policy'}
          />
          <CardBody>
            <SlaSummary sla={ticket.sla} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Details" />
          <CardBody className="space-y-3 text-sm">
            <Detail label="Assigned staff member">
              {ticket.assignee ? (
                <span className="flex items-center gap-2">
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                    style={{ backgroundColor: ticket.assignee.avatarColor }}
                    aria-hidden
                  >
                    {initials(ticket.assignee.name)}
                  </span>
                  {ticket.assignee.name}
                </span>
              ) : (
                <span className="text-muted">Waiting for assignment</span>
              )}
            </Detail>
            <Detail label="Created">{formatDateTime(ticket.createdAt)}</Detail>
            <Detail label="Category">
              <CategoryBadge category={ticket.category} />
            </Detail>
            {ticket.aiSentiment && (
              <Detail label="Detected tone">
                <SentimentBadge sentiment={ticket.aiSentiment} />
              </Detail>
            )}
          </CardBody>
        </Card>

        {isResolved && (
          <Card>
            <CardHeader
              title="How did we do?"
              icon={<Star className="h-4 w-4" />}
              description={rating ? 'Thanks for rating this ticket.' : 'Rate this support interaction'}
            />
            <CardBody>
              <div className="flex gap-1.5" role="group" aria-label="Satisfaction rating">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    disabled={Boolean(rating) || working}
                    onClick={() => submitRating(value)}
                    onMouseEnter={() => setHoverRating(value)}
                    onMouseLeave={() => setHoverRating(0)}
                    aria-label={`${value} out of 5`}
                    className={cn(
                      'rounded p-0.5 transition-transform',
                      !rating && 'hover:scale-110',
                      rating && 'cursor-default',
                    )}
                  >
                    <Star
                      className={cn(
                        'h-6 w-6 transition-colors',
                        value <= (hoverRating || rating || 0)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-line',
                      )}
                      aria-hidden
                    />
                  </button>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader title="Actions" />
          <CardBody className="space-y-2">
            {isClosed ? (
              <Button variant="outline" fullWidth loading={working} onClick={() => changeStatus('OPEN')}>
                <RotateCcw className="h-4 w-4" aria-hidden />
                Reopen ticket
              </Button>
            ) : (
              <Button
                variant="outline"
                fullWidth
                disabled={working}
                onClick={() => setConfirmClose(true)}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Close ticket
              </Button>
            )}
            <p className="text-xs leading-relaxed text-muted">
              Closing tells us the issue is sorted. You can reopen it at any time if it comes back.
            </p>
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        onConfirm={() => changeStatus('CLOSED')}
        title="Close this ticket?"
        message="We'll stop working on it. You can reopen the ticket later if you need to."
        confirmLabel="Close ticket"
        tone="primary"
        loading={working}
      />
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-xs text-muted">{label}</span>
      <span className="min-w-0 text-right text-sm text-ink">{children}</span>
    </div>
  );
}

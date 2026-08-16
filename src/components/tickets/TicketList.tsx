'use client';

import { MessageSquare, Paperclip, TriangleAlert } from 'lucide-react';
import Link from 'next/link';

import {
  CategoryBadge,
  PriorityBadge,
  SentimentBadge,
  StatusBadge,
} from '@/components/ui/Badge';
import { cn, initials, relativeTime, truncate } from '@/lib/utils';

import { SlaTimer, type SlaClockData } from './SlaTimer';

export type TicketRow = {
  id: string;
  number: number;
  subject: string;
  status: string;
  priority: string;
  category: string;
  aiSummary: string | null;
  aiSentiment: string | null;
  aiConfidence: number | null;
  aiTags: string[];
  createdAt: string;
  updatedAt: string;
  satisfaction: number | null;
  autoAssigned: boolean;
  member: {
    id: string;
    name: string;
    email: string;
    avatarColor: string;
    memberProfile: { tier: string; status: string; memberNumber: string } | null;
  };
  assignee: { id: string; name: string; email: string; avatarColor: string } | null;
  _count: { messages: number; attachments: number; escalations: number };
  sla: { firstResponse: SlaClockData; resolution: SlaClockData; worstState: string };
};

/**
 * Ticket list used by every role. `basePath` decides where rows link to, so
 * members land on their view and staff on the workspace.
 */
export function TicketList({
  tickets,
  basePath,
  showMember = false,
  showAssignee = false,
}: {
  tickets: TicketRow[];
  basePath: string;
  showMember?: boolean;
  showAssignee?: boolean;
}) {
  return (
    <ul className="divide-y divide-line">
      {tickets.map((ticket) => {
        const activeClock =
          ticket.sla.firstResponse.state === 'met' ? ticket.sla.resolution : ticket.sla.firstResponse;
        const hasEscalation = ticket._count.escalations > 0;

        return (
          <li key={ticket.id}>
            <Link
              href={`${basePath}/${ticket.id}`}
              className="block px-4 py-3.5 transition-colors hover:bg-surface-2/60 sm:px-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-mono text-xs text-muted">#{ticket.number}</span>
                    <h3 className="min-w-0 truncate text-sm font-semibold text-ink">{ticket.subject}</h3>
                    {hasEscalation && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300"
                        title={`${ticket._count.escalations} escalation(s)`}
                      >
                        <TriangleAlert className="h-3 w-3" aria-hidden />
                        Escalated
                      </span>
                    )}
                  </div>

                  {ticket.aiSummary && (
                    <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">
                      {truncate(ticket.aiSummary, 180)}
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={ticket.status} />
                    <PriorityBadge priority={ticket.priority} />
                    <CategoryBadge category={ticket.category} />
                    {ticket.aiSentiment && <SentimentBadge sentiment={ticket.aiSentiment} />}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-muted">
                    <span>Opened {relativeTime(ticket.createdAt)}</span>
                    {ticket._count.messages > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                        {ticket._count.messages}
                      </span>
                    )}
                    {ticket._count.attachments > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Paperclip className="h-3.5 w-3.5" aria-hidden />
                        {ticket._count.attachments}
                      </span>
                    )}
                    {showMember && (
                      <span className="inline-flex items-center gap-1.5">
                        <Avatar name={ticket.member.name} color={ticket.member.avatarColor} />
                        {ticket.member.name}
                        {ticket.member.memberProfile && (
                          <span className="text-muted/70">
                            · {ticket.member.memberProfile.memberNumber}
                          </span>
                        )}
                      </span>
                    )}
                    {showAssignee && (
                      <span className="inline-flex items-center gap-1.5">
                        {ticket.assignee ? (
                          <>
                            <Avatar name={ticket.assignee.name} color={ticket.assignee.avatarColor} />
                            {ticket.assignee.name}
                            {ticket.autoAssigned && (
                              <span className="text-muted/70" title="Assigned automatically by AI triage">
                                (auto)
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="font-medium text-amber-600 dark:text-amber-400">Unassigned</span>
                        )}
                      </span>
                    )}
                  </div>
                </div>

                <div className="w-full shrink-0 sm:w-44">
                  <SlaTimer clock={activeClock} />
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Avatar({ name, color }: { name: string; color: string }) {
  return (
    <span
      className={cn('flex h-4.5 w-4.5 items-center justify-center rounded-full text-[9px] font-semibold text-white')}
      style={{ backgroundColor: color, height: '18px', width: '18px' }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

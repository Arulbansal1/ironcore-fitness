import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Inbox,
  Sparkles,
  UserX,
} from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/layout/AppShell';
import { TicketList } from '@/components/tickets/TicketList';
import { Card, CardBody, CardHeader, EmptyState } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { serializeTicket, ticketCounts, ticketListSelect } from '@/lib/tickets';
import { relativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function StaffOverviewPage() {
  const user = await getSession();
  if (!user) redirect('/login');

  const mine = { assigneeId: user.id };

  const [myCounts, queueCounts, myTickets, atRisk, pendingDrafts, openEscalations] =
    await Promise.all([
      ticketCounts(mine),
      ticketCounts({}),
      prisma.ticket.findMany({
        where: { ...mine, status: { in: ['OPEN', 'IN_PROGRESS', 'PENDING_MEMBER'] } },
        select: ticketListSelect,
        orderBy: [{ priority: 'desc' }, { firstResponseDue: 'asc' }],
        take: 6,
      }),
      // Awaiting a first response and past 75% of the SLA window.
      prisma.ticket.findMany({
        where: {
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          firstRespondedAt: null,
          firstResponseDue: { not: null },
        },
        select: ticketListSelect,
        orderBy: { firstResponseDue: 'asc' },
        take: 20,
      }),
      prisma.aiSuggestion.count({ where: { status: 'PENDING' } }),
      prisma.escalation.findMany({
        where: { status: 'OPEN' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { ticket: { select: { id: true, number: true, subject: true } } },
      }),
    ]);

  const now = Date.now();
  const urgentQueue = atRisk
    .map(serializeTicket)
    .filter((ticket) => {
      const due = ticket.sla.firstResponse.dueAt;
      if (!due) return false;
      const started = new Date(ticket.createdAt).getTime();
      const deadline = new Date(due).getTime();
      return (now - started) / Math.max(deadline - started, 1) >= 0.75;
    })
    .slice(0, 5);

  return (
    <>
      <PageHeader
        title={`Your queue, ${user.name.split(' ')[0]}`}
        description="Tickets assigned to you, plus anything at risk of breaching across the desk."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Assigned to you"
          value={myCounts.active}
          hint={`${myCounts.open} open · ${myCounts.inProgress} in progress`}
          icon={<Inbox className="h-4 w-4" />}
          tone="brand"
          href={`/staff/tickets?assigneeId=${user.id}`}
        />
        <StatTile
          label="Awaiting your reply"
          value={myCounts.open}
          hint="No first response yet"
          icon={<Clock className="h-4 w-4" />}
          tone="warning"
          href={`/staff/tickets?assigneeId=${user.id}&status=OPEN`}
        />
        <StatTile
          label="Unassigned in queue"
          value={queueCounts.unassigned}
          hint="Available to pick up"
          icon={<UserX className="h-4 w-4" />}
          tone={queueCounts.unassigned > 0 ? 'warning' : 'neutral'}
          href="/staff/tickets?assigneeId=unassigned"
        />
        <StatTile
          label="SLA breached"
          value={queueCounts.breached}
          hint="Across the whole desk"
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={queueCounts.breached > 0 ? 'danger' : 'success'}
          href="/staff/tickets?breached=true"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Your active tickets"
            description="Highest priority and nearest SLA deadline first"
            action={
              <Link
                href={`/staff/tickets?assigneeId=${user.id}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
              >
                View all
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            }
          />
          {myTickets.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-5 w-5" />}
              title="Your queue is clear"
              description="Nothing is assigned to you right now. Check the unassigned queue for work to pick up."
            />
          ) : (
            <TicketList
              tickets={myTickets.map(serializeTicket)}
              basePath="/staff/tickets"
              showMember
            />
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="At risk of breaching"
              icon={<AlertTriangle className="h-4 w-4" />}
              description="75%+ of the first-response window used"
            />
            {urgentQueue.length === 0 ? (
              <CardBody>
                <p className="text-sm text-muted">Nothing at risk right now.</p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-line">
                {urgentQueue.map((ticket) => (
                  <li key={ticket.id}>
                    <Link
                      href={`/staff/tickets/${ticket.id}`}
                      className="block px-4 py-3 transition-colors hover:bg-surface-2/60 sm:px-5"
                    >
                      <p className="truncate text-sm font-medium text-ink">
                        <span className="font-mono text-xs text-muted">#{ticket.number}</span>{' '}
                        {ticket.subject}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {ticket.priority.toLowerCase()} · {ticket.member.name}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="AI drafts waiting" icon={<Sparkles className="h-4 w-4" />} />
            <CardBody>
              <p className="text-2xl font-semibold tabular-nums text-ink">{pendingDrafts}</p>
              <p className="mt-0.5 text-xs text-muted">
                Drafts generated and awaiting a human review.
              </p>
              <Link
                href="/staff/ai-drafts"
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
              >
                Review drafts
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </CardBody>
          </Card>

          {openEscalations.length > 0 && (
            <Card>
              <CardHeader
                title="Open escalations"
                icon={<AlertTriangle className="h-4 w-4" />}
                description={`${openEscalations.length} needing attention`}
              />
              <ul className="divide-y divide-line">
                {openEscalations.map((escalation) => (
                  <li key={escalation.id}>
                    <Link
                      href={`/staff/tickets/${escalation.ticket.id}`}
                      className="block px-4 py-3 transition-colors hover:bg-surface-2/60 sm:px-5"
                    >
                      <p className="truncate text-sm font-medium text-ink">
                        <span className="font-mono text-xs text-muted">#{escalation.ticket.number}</span>{' '}
                        {escalation.ticket.subject}
                      </p>
                      <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
                        {escalation.reason.replace(/_/g, ' ').toLowerCase()} · L{escalation.level} ·{' '}
                        {relativeTime(escalation.createdAt)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

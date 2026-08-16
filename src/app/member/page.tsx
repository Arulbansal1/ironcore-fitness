import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Inbox,
  PlusCircle,
  Ticket as TicketIcon,
} from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/layout/AppShell';
import { TicketList } from '@/components/tickets/TicketList';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, EmptyState } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { serializeTicket, ticketCounts, ticketListSelect } from '@/lib/tickets';

export const dynamic = 'force-dynamic';

export default async function MemberOverviewPage() {
  const user = await getSession();
  if (!user) redirect('/login');

  const where = { memberId: user.id };

  const [counts, recentRows, articles, resolvedWithRating] = await Promise.all([
    ticketCounts(where),
    prisma.ticket.findMany({
      where,
      select: ticketListSelect,
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
    prisma.kbArticle.findMany({
      where: { isPublished: true },
      orderBy: { views: 'desc' },
      take: 4,
      select: { id: true, title: true, summary: true, slug: true, category: true },
    }),
    prisma.ticket.findMany({
      where: { ...where, satisfaction: { not: null } },
      select: { satisfaction: true },
    }),
  ]);

  const tickets = recentRows.map(serializeTicket);
  const avgRating =
    resolvedWithRating.length > 0
      ? (
          resolvedWithRating.reduce((sum, t) => sum + (t.satisfaction ?? 0), 0) / resolvedWithRating.length
        ).toFixed(1)
      : null;

  const awaitingYou = tickets.filter((t) => t.status === 'PENDING_MEMBER').length;

  return (
    <>
      <PageHeader
        title={`Hello, ${user.name.split(' ')[0]}`}
        description="Track your support requests and open new ones."
        action={
          <Link href="/member/tickets/new">
            <Button>
              <PlusCircle className="h-4 w-4" aria-hidden />
              New ticket
            </Button>
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Open tickets"
          value={counts.active}
          hint={awaitingYou > 0 ? `${awaitingYou} waiting on your reply` : 'Nothing waiting on you'}
          icon={<Inbox className="h-4 w-4" />}
          tone="brand"
          href="/member/tickets?status=OPEN"
        />
        <StatTile
          label="In progress"
          value={counts.inProgress}
          hint="A staff is working on these"
          icon={<Clock className="h-4 w-4" />}
          tone="warning"
          href="/member/tickets?status=IN_PROGRESS"
        />
        <StatTile
          label="Resolved"
          value={counts.resolved + counts.closed}
          hint="Closed or resolved"
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="success"
          href="/member/tickets?status=RESOLVED"
        />
        <StatTile
          label="Your average rating"
          value={avgRating ? `${avgRating}/5` : '—'}
          hint={avgRating ? `From ${resolvedWithRating.length} rated ticket(s)` : 'Rate a resolved ticket'}
          icon={<TicketIcon className="h-4 w-4" />}
          tone="neutral"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent tickets"
            description="Your five most recently updated requests"
            action={
              <Link
                href="/member/tickets"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
              >
                View all
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            }
          />
          {tickets.length === 0 ? (
            <EmptyState
              icon={<TicketIcon className="h-5 w-5" />}
              title="No tickets yet"
              description="When you open a support request it will appear here with a live SLA timer."
              action={
                <Link href="/member/tickets/new">
                  <Button size="sm">Create your first ticket</Button>
                </Link>
              }
            />
          ) : (
            <TicketList tickets={tickets} basePath="/member/tickets" showAssignee />
          )}
        </Card>

        <Card>
          <CardHeader
            title="Popular help articles"
            icon={<BookOpen className="h-4 w-4" />}
            description="Answers before you open a ticket"
          />
          <CardBody className="space-y-3">
            {articles.map((article) => (
              <Link
                key={article.id}
                href={`/member/knowledge-base/${article.slug}`}
                className="block rounded-lg border border-line p-3 transition-colors hover:border-brand-500/60 hover:bg-surface-2/50"
              >
                <p className="text-sm font-medium text-ink">{article.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted">{article.summary}</p>
              </Link>
            ))}
            <Link
              href="/member/knowledge-base"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
            >
              Browse the help centre
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

import { Inbox } from 'lucide-react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/layout/AppShell';
import { TicketFilters } from '@/components/tickets/TicketFilters';
import { TicketList } from '@/components/tickets/TicketList';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { Pagination } from '@/components/ui/Pagination';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { listTickets } from '@/lib/tickets';

export const metadata: Metadata = { title: 'Ticket queue' };
export const dynamic = 'force-dynamic';

export default async function StaffTicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await getSession();
  if (!user) redirect('/login');

  const params = await searchParams;

  const [{ tickets, pagination }, staff] = await Promise.all([
    listTickets({
      user,
      status: params.status ? [params.status] : undefined,
      priority: params.priority ? [params.priority] : undefined,
      category: params.category ? [params.category] : undefined,
      assigneeId: params.assigneeId,
      search: params.search,
      breachedOnly: params.breached === 'true',
      sort: (params.sort as 'newest' | 'oldest' | 'priority' | 'sla') ?? 'priority',
      page: Number(params.page) || 1,
      pageSize: 15,
    }),
    prisma.user.findMany({
      where: { role: { in: ['STAFF', 'ADMIN'] }, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Ticket queue"
        description={`${pagination.total} ticket${pagination.total === 1 ? '' : 's'} matching your filters`}
      />

      <div className="mb-4">
        <TicketFilters showAssignment staff={staff} />
      </div>

      <Card>
        <CardHeader title="Tickets" description={`Page ${pagination.page} of ${pagination.totalPages}`} />
        {tickets.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-5 w-5" />}
            title="No tickets match these filters"
            description="Try widening the filters or clearing them entirely."
          />
        ) : (
          <>
            <TicketList tickets={tickets} basePath="/staff/tickets" showMember showAssignee />
            <Pagination pagination={pagination} />
          </>
        )}
      </Card>
    </>
  );
}

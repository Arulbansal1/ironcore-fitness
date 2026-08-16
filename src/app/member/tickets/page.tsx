import { PlusCircle, Ticket as TicketIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/layout/AppShell';
import { Pagination } from '@/components/ui/Pagination';
import { TicketFilters } from '@/components/tickets/TicketFilters';
import { TicketList } from '@/components/tickets/TicketList';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { getSession } from '@/lib/auth';
import { listTickets } from '@/lib/tickets';

export const metadata: Metadata = { title: 'My tickets' };
export const dynamic = 'force-dynamic';

export default async function MemberTicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await getSession();
  if (!user) redirect('/login');

  const params = await searchParams;

  const { tickets, pagination } = await listTickets({
    user,
    status: params.status ? [params.status] : undefined,
    priority: params.priority ? [params.priority] : undefined,
    category: params.category ? [params.category] : undefined,
    search: params.search,
    sort: (params.sort as 'newest' | 'oldest' | 'priority' | 'sla') ?? 'newest',
    page: Number(params.page) || 1,
    pageSize: 15,
  });

  return (
    <>
      <PageHeader
        title="My tickets"
        description={`${pagination.total} ticket${pagination.total === 1 ? '' : 's'} total`}
        action={
          <Link href="/member/tickets/new">
            <Button>
              <PlusCircle className="h-4 w-4" aria-hidden />
              New ticket
            </Button>
          </Link>
        }
      />

      <div className="mb-4">
        <TicketFilters />
      </div>

      <Card>
        <CardHeader
          title="All tickets"
          description={`Page ${pagination.page} of ${pagination.totalPages}`}
        />
        {tickets.length === 0 ? (
          <EmptyState
            icon={<TicketIcon className="h-5 w-5" />}
            title="No tickets match these filters"
            description="Try clearing the filters, or open a new support request."
            action={
              <Link href="/member/tickets/new">
                <Button size="sm">New ticket</Button>
              </Link>
            }
          />
        ) : (
          <>
            <TicketList tickets={tickets} basePath="/member/tickets" showAssignee />
            <Pagination pagination={pagination} />
          </>
        )}
      </Card>
    </>
  );
}

import { AlertTriangle } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHeader } from '@/components/layout/AppShell';
import { EscalationTable } from '@/components/escalations/EscalationTable';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import { integrationStatus } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Escalations' };
export const dynamic = 'force-dynamic';

const FILTERS = [
  { value: 'OPEN', label: 'Open' },
  { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'ALL', label: 'All' },
];

export default async function StaffEscalationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const status = params.status ?? 'OPEN';
  const integrations = integrationStatus();

  const [escalations, open, acknowledged, resolved, slackSent] = await Promise.all([
    prisma.escalation.findMany({
      where: status === 'ALL' ? {} : { status: status as never },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
      include: {
        ticket: {
          select: {
            id: true,
            number: true,
            subject: true,
            status: true,
            priority: true,
            member: { select: { name: true, email: true } },
            assignee: { select: { name: true } },
          },
        },
        acknowledgedBy: { select: { id: true, name: true } },
      },
    }),
    prisma.escalation.count({ where: { status: 'OPEN' } }),
    prisma.escalation.count({ where: { status: 'ACKNOWLEDGED' } }),
    prisma.escalation.count({ where: { status: 'RESOLVED' } }),
    prisma.escalation.count({ where: { slackNotified: true } }),
  ]);

  return (
    <>
      <PageHeader
        title="Escalations"
        description="SLA breaches and manual escalations, with Slack delivery status."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Open"
          value={open}
          hint="Needs attention now"
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={open > 0 ? 'danger' : 'success'}
        />
        <StatTile label="Acknowledged" value={acknowledged} hint="Someone is on it" tone="warning" />
        <StatTile label="Resolved" value={resolved} hint="Closed out" tone="success" />
        <StatTile
          label="Slack delivered"
          value={slackSent}
          hint={
            integrations.slack === 'webhook'
              ? 'Webhook configured'
              : 'SLACK_WEBHOOK_URL not set — alerts stay in-app'
          }
          tone={integrations.slack === 'webhook' ? 'success' : 'neutral'}
        />
      </div>

      <div className="mt-5 mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={`/staff/escalations?status=${filter.value}`}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              status === filter.value
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-line text-muted hover:text-ink',
            )}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader
          title={`${escalations.length} escalation${escalations.length === 1 ? '' : 's'}`}
          description={status === 'ALL' ? 'All statuses' : `Filtered to ${status.toLowerCase()}`}
        />
        <EscalationTable
          escalations={escalations.map((escalation) => ({
            ...escalation,
            createdAt: escalation.createdAt.toISOString(),
            acknowledgedAt: escalation.acknowledgedAt?.toISOString() ?? null,
          }))}
          ticketBasePath="/staff/tickets"
        />
      </Card>
    </>
  );
}

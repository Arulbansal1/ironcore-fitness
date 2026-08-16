import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Bot,
  Inbox,
  Mail,
  Slack,
  Ticket as TicketIcon,
  Users,
} from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/layout/AppShell';
import { TicketList } from '@/components/tickets/TicketList';
import { Card, CardBody, CardHeader, EmptyState } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import { integrationStatus } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { vectorIndexStats } from '@/lib/rag';
import { serializeTicket, ticketCounts, ticketListSelect } from '@/lib/tickets';
import { relativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage() {
  const integrations = integrationStatus();

  const [counts, userCounts, kbStats, openEscalations, recent, pendingDrafts, recentAudit] =
    await Promise.all([
      ticketCounts(),
      prisma.user.groupBy({ by: ['role'], _count: true }),
      vectorIndexStats(),
      prisma.escalation.count({ where: { status: 'OPEN' } }),
      prisma.ticket.findMany({
        select: ticketListSelect,
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      prisma.aiSuggestion.count({ where: { status: 'PENDING' } }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { actor: { select: { name: true } } },
      }),
    ]);

  const byRole = Object.fromEntries(userCounts.map((row) => [row.role, row._count]));

  const integrationCards = [
    {
      icon: Mail,
      label: 'Email (Brevo)',
      value: integrations.email === 'brevo' ? 'Connected' : 'Console fallback',
      detail:
        integrations.email === 'brevo'
          ? 'OTP codes and reply notifications are delivered by Brevo.'
          : 'Set BREVO_API_KEY to send real email. OTPs are printed to the server log.',
      ok: integrations.email === 'brevo',
    },
    {
      icon: Bot,
      label: 'AI (OpenAI)',
      value: integrations.ai === 'openai' ? 'Connected' : 'Local engine',
      detail:
        integrations.ai === 'openai'
          ? 'Triage and reply drafts run on the OpenAI API.'
          : 'Set OPENAI_API_KEY for semantic embeddings. The local keyword engine is active.',
      ok: integrations.ai === 'openai',
    },
    {
      icon: Slack,
      label: 'Slack alerts',
      value: integrations.slack === 'webhook' ? 'Connected' : 'In-app only',
      detail:
        integrations.slack === 'webhook'
          ? 'SLA breaches post to your support channel.'
          : 'Set SLACK_WEBHOOK_URL to push breach alerts. Escalations are still recorded in-app.',
      ok: integrations.slack === 'webhook',
    },
  ];

  return (
    <>
      <PageHeader
        title="Administration"
        description="Whole-desk view of queue health, staffing, knowledge and system integrations."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Active tickets"
          value={counts.active}
          hint={`${counts.total} total · ${counts.unassigned} unassigned`}
          icon={<Inbox className="h-4 w-4" />}
          tone="brand"
          href="/admin/tickets"
        />
        <StatTile
          label="SLA breached"
          value={counts.breached}
          hint="Still open and past target"
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={counts.breached > 0 ? 'danger' : 'success'}
          href="/admin/tickets?breached=true"
        />
        <StatTile
          label="Open escalations"
          value={openEscalations}
          hint="Awaiting acknowledgement"
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={openEscalations > 0 ? 'warning' : 'success'}
          href="/admin/escalations"
        />
        <StatTile
          label="People"
          value={(byRole.MEMBER ?? 0) + (byRole.STAFF ?? 0) + (byRole.ADMIN ?? 0)}
          hint={`${byRole.STAFF ?? 0} staff · ${byRole.ADMIN ?? 0} admins · ${byRole.MEMBER ?? 0} members`}
          icon={<Users className="h-4 w-4" />}
          href="/admin/users"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Newest tickets"
            description="Across every member"
            action={
              <Link
                href="/admin/tickets"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
              >
                View all
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            }
          />
          {recent.length === 0 ? (
            <EmptyState
              icon={<TicketIcon className="h-5 w-5" />}
              title="No tickets yet"
              description="Run `npm run db:seed` to load the demo dataset."
            />
          ) : (
            <TicketList
              tickets={recent.map(serializeTicket)}
              basePath="/admin/tickets"
              showMember
              showAssignee
            />
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="System integrations" description="Optional services and their fallbacks" />
            <CardBody className="space-y-3">
              {integrationCards.map((item) => (
                <div key={item.label} className="rounded-lg border border-line p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-medium text-ink">
                      <item.icon className="h-4 w-4 text-muted" aria-hidden />
                      {item.label}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
                      <span
                        className={`h-2 w-2 rounded-full ${item.ok ? 'bg-emerald-500' : 'bg-amber-500'}`}
                        aria-hidden
                      />
                      {item.value}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{item.detail}</p>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Knowledge base" icon={<BookOpen className="h-4 w-4" />} />
            <CardBody className="space-y-1.5 text-sm">
              <Row label="Articles" value={`${kbStats.published} published of ${kbStats.articles}`} />
              <Row label="Vector chunks" value={String(kbStats.chunks)} />
              <Row label="AI drafts pending" value={String(pendingDrafts)} />
              <Link
                href="/admin/knowledge-base"
                className="inline-flex items-center gap-1 pt-1 text-sm font-medium text-brand-600 hover:underline"
              >
                Manage knowledge base
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Recent activity"
          description="Every privileged action is recorded"
          action={
            <Link
              href="/admin/audit"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
            >
              Full audit log
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          }
        />
        <ul className="divide-y divide-line">
          {recentAudit.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
              <span className="min-w-0 text-sm text-ink">
                <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-muted">
                  {entry.action}
                </code>{' '}
                {entry.detail ?? entry.entityType}
              </span>
              <span className="shrink-0 text-xs text-muted">
                {entry.actor?.name ?? entry.actorEmail ?? 'system'} · {relativeTime(entry.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm text-ink">{value}</span>
    </div>
  );
}

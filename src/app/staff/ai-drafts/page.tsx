import { Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHeader } from '@/components/layout/AppShell';
import { Badge, ConfidenceBadge, PriorityBadge, StatusBadge } from '@/components/ui/Badge';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import { prisma } from '@/lib/prisma';
import { relativeTime, truncate } from '@/lib/utils';

export const metadata: Metadata = { title: 'AI drafts' };
export const dynamic = 'force-dynamic';

export default async function AiDraftsPage() {
  const [pending, reviewed, stats] = await Promise.all([
    prisma.aiSuggestion.findMany({
      where: { status: 'PENDING', ticket: { status: { notIn: ['CLOSED'] } } },
      orderBy: [{ createdAt: 'desc' }],
      take: 40,
      include: {
        ticket: {
          select: {
            id: true,
            number: true,
            subject: true,
            status: true,
            priority: true,
            member: { select: { name: true } },
            assignee: { select: { name: true } },
          },
        },
      },
    }),
    prisma.aiSuggestion.findMany({
      where: { status: { not: 'PENDING' } },
      orderBy: { reviewedAt: 'desc' },
      take: 15,
      include: {
        ticket: { select: { id: true, number: true, subject: true } },
        reviewedBy: { select: { name: true } },
      },
    }),
    Promise.all([
      prisma.aiSuggestion.count(),
      prisma.aiSuggestion.count({ where: { status: 'PENDING' } }),
      prisma.aiSuggestion.count({ where: { status: 'APPROVED' } }),
      prisma.aiSuggestion.count({ where: { status: 'EDITED' } }),
      prisma.aiSuggestion.count({ where: { status: 'REJECTED' } }),
      prisma.aiSuggestion.aggregate({ _avg: { confidence: true } }),
    ]),
  ]);

  const [total, pendingCount, approved, edited, rejected, avg] = stats;
  const reviewedTotal = approved + edited + rejected;
  const acceptanceRate = reviewedTotal > 0 ? Math.round(((approved + edited) / reviewedTotal) * 100) : null;

  return (
    <>
      <PageHeader
        title="AI reply drafts"
        description="Every draft is reviewed by a human before anything reaches a member."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Awaiting review"
          value={pendingCount}
          hint="On tickets that are still open"
          icon={<Sparkles className="h-4 w-4" />}
          tone={pendingCount > 0 ? 'brand' : 'neutral'}
        />
        <StatTile
          label="Acceptance rate"
          value={acceptanceRate === null ? '—' : `${acceptanceRate}%`}
          hint={`${approved} approved · ${edited} edited · ${rejected} rejected`}
          tone={acceptanceRate !== null && acceptanceRate >= 70 ? 'success' : 'warning'}
        />
        <StatTile
          label="Average confidence"
          value={avg._avg.confidence ? `${Math.round(avg._avg.confidence * 100)}%` : '—'}
          hint="Blended model + retrieval score"
        />
        <StatTile label="Drafts generated" value={total} hint="All time" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Pending review"
            description="Open the ticket to approve, edit or reject the draft"
          />
          {pending.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="h-5 w-5" />}
              title="No drafts waiting"
              description="Every AI draft on an open ticket has been reviewed."
            />
          ) : (
            <ul className="divide-y divide-line">
              {pending.map((suggestion) => (
                <li key={suggestion.id}>
                  <Link
                    href={`/staff/tickets/${suggestion.ticket.id}`}
                    className="block px-4 py-3.5 transition-colors hover:bg-surface-2/60 sm:px-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="min-w-0 text-sm font-semibold text-ink">
                        <span className="font-mono text-xs text-muted">#{suggestion.ticket.number}</span>{' '}
                        {suggestion.ticket.subject}
                      </p>
                      <div className="flex shrink-0 gap-1.5">
                        <ConfidenceBadge value={suggestion.confidence} />
                        <PriorityBadge priority={suggestion.ticket.priority} />
                      </div>
                    </div>

                    <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                      {truncate(suggestion.draft.replace(/\n+/g, ' '), 220)}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      <StatusBadge status={suggestion.ticket.status} />
                      <span>{suggestion.ticket.member.name}</span>
                      <span>{suggestion.ticket.assignee?.name ?? 'Unassigned'}</span>
                      <span>{suggestion.model}</span>
                      <span>{relativeTime(suggestion.createdAt)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Recently reviewed" description="Human decisions on AI output" />
          {reviewed.length === 0 ? (
            <EmptyState title="Nothing reviewed yet" description="Approved and rejected drafts appear here." />
          ) : (
            <ul className="divide-y divide-line">
              {reviewed.map((suggestion) => (
                <li key={suggestion.id}>
                  <Link
                    href={`/staff/tickets/${suggestion.ticket.id}`}
                    className="block px-4 py-3 transition-colors hover:bg-surface-2/60 sm:px-5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-sm text-ink">
                        <span className="font-mono text-xs text-muted">#{suggestion.ticket.number}</span>{' '}
                        {suggestion.ticket.subject}
                      </p>
                      <Badge
                        tone={
                          suggestion.status === 'REJECTED'
                            ? 'neutral'
                            : suggestion.status === 'EDITED'
                              ? 'brand'
                              : 'success'
                        }
                      >
                        {suggestion.status.toLowerCase()}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {suggestion.reviewedBy?.name ?? 'Unknown'} ·{' '}
                      {suggestion.reviewedAt ? relativeTime(suggestion.reviewedAt) : ''}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

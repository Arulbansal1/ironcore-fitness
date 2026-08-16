'use client';

import { CheckCircle2, ShieldCheck, Slack } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge, PriorityBadge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { relativeTime } from '@/lib/utils';

export type EscalationRow = {
  id: string;
  reason: string;
  level: number;
  status: string;
  detail: string;
  slackNotified: boolean;
  slackError: string | null;
  createdAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: { id: string; name: string } | null;
  ticket: {
    id: string;
    number: number;
    subject: string;
    status: string;
    priority: string;
    member: { name: string; email: string };
    assignee: { name: string } | null;
  };
};

const REASON_LABEL: Record<string, string> = {
  FIRST_RESPONSE_BREACH: 'First response SLA breached',
  RESOLUTION_BREACH: 'Resolution SLA breached',
  NEGATIVE_SENTIMENT: 'Negative sentiment detected',
  MANUAL: 'Manually escalated',
  REOPENED: 'Ticket reopened',
};

export function EscalationTable({
  escalations,
  ticketBasePath,
}: {
  escalations: EscalationRow[];
  ticketBasePath: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, action: 'acknowledge' | 'resolve') {
    setBusy(id);
    try {
      await apiFetch(`/api/escalations/${id}`, { method: 'PATCH', body: { action } });
      toast.success(action === 'resolve' ? 'Escalation resolved.' : 'Escalation acknowledged.');
      router.refresh();
    } catch (caught) {
      toast.error('Could not update the escalation', errorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  if (escalations.length === 0) {
    return (
      <EmptyState
        icon={<ShieldCheck className="h-5 w-5" />}
        title="No escalations"
        description="Nothing has breached its SLA or been escalated manually."
      />
    );
  }

  return (
    <ul className="divide-y divide-line">
      {escalations.map((escalation) => (
        <li key={escalation.id} className="px-4 py-3.5 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge
                  tone={
                    escalation.status === 'OPEN'
                      ? 'danger'
                      : escalation.status === 'ACKNOWLEDGED'
                        ? 'warning'
                        : 'success'
                  }
                  dot
                >
                  {escalation.status.toLowerCase()}
                </Badge>
                <Badge tone={escalation.level >= 2 ? 'danger' : 'warning'}>Level {escalation.level}</Badge>
                <span className="text-xs font-medium text-ink">
                  {REASON_LABEL[escalation.reason] ?? escalation.reason}
                </span>
                <Badge tone={escalation.slackNotified ? 'success' : 'neutral'}>
                  <Slack className="h-3 w-3" aria-hidden />
                  {escalation.slackNotified ? 'Slack sent' : 'Slack not sent'}
                </Badge>
              </div>

              <Link
                href={`${ticketBasePath}/${escalation.ticket.id}`}
                className="mt-1.5 block text-sm font-semibold text-ink hover:text-brand-600"
              >
                <span className="font-mono text-xs text-muted">#{escalation.ticket.number}</span>{' '}
                {escalation.ticket.subject}
              </Link>

              <p className="mt-1 text-sm leading-relaxed text-muted">{escalation.detail}</p>

              {!escalation.slackNotified && escalation.slackError && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  Slack: {escalation.slackError}
                </p>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                <StatusBadge status={escalation.ticket.status} />
                <PriorityBadge priority={escalation.ticket.priority} />
                <span>{escalation.ticket.member.name}</span>
                <span>{escalation.ticket.assignee?.name ?? 'Unassigned'}</span>
                <span>Raised {relativeTime(escalation.createdAt)}</span>
                {escalation.acknowledgedBy && (
                  <span>Acknowledged by {escalation.acknowledgedBy.name}</span>
                )}
              </div>
            </div>

            {escalation.status !== 'RESOLVED' && (
              <div className="flex shrink-0 gap-1.5">
                {escalation.status === 'OPEN' && (
                  <Button
                    size="sm"
                    variant="outline"
                    loading={busy === escalation.id}
                    onClick={() => act(escalation.id, 'acknowledge')}
                  >
                    Acknowledge
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="success"
                  loading={busy === escalation.id}
                  onClick={() => act(escalation.id, 'resolve')}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  Resolve
                </Button>
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

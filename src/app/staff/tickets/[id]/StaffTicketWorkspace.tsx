'use client';

import {
  AlertTriangle,
  Bot,
  Building2,
  History,
  Mail,
  MessagesSquare,
  Paperclip,
  Star,
  Timer,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { AiDraftPanel, type AiSuggestion } from '@/components/tickets/AiDraftPanel';
import { Conversation, type ConversationMessage } from '@/components/tickets/Conversation';
import { KbLookup } from '@/components/tickets/KbLookup';
import { MemberContextPanel, type MemberContext } from '@/components/members/MemberContextPanel';
import { SlaSummary, type SlaClockData } from '@/components/tickets/SlaTimer';
import { TicketTimeline, type TimelineEvent } from '@/components/tickets/TicketTimeline';
import {
  Badge,
  CategoryBadge,
  ConfidenceBadge,
  PriorityBadge,
  SentimentBadge,
  StatusBadge,
} from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Select } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from '@/lib/constants';
import { cn, formatBytes, formatDate, formatDateTime, initials, relativeTime } from '@/lib/utils';

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
  aiConfidence: number | null;
  aiTags: string[];
  aiEngine: string | null;
  autoAssigned: boolean;
  safetyFlag: boolean;
  reopenCount: number;
  satisfaction: number | null;
  createdAt: string;
  updatedAt: string;
  member: MemberContext;
  assignee: { id: string; name: string; email: string; avatarColor: string } | null;
  slaPolicyName: string | null;
  sla: { firstResponse: SlaClockData; resolution: SlaClockData; worstState: string };
};

type Staff = {
  id: string;
  name: string;
  avatarColor: string;
  specialties: string[];
  isAvailable: boolean;
  openTickets: number;
  maxOpenTickets: number | null;
};

type Escalation = {
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
};

type Attachment = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploader: { name: string } | null;
};

type HistoryTicket = {
  id: string;
  number: number;
  subject: string;
  status: string;
  priority: string;
  satisfaction: number | null;
  createdAt: string;
};

export function StaffTicketWorkspace({
  ticket,
  messages,
  events,
  attachments,
  suggestions,
  escalations,
  staff,
  memberHistory,
  currentUserId,
  currentUserRole,
}: {
  ticket: Ticket;
  messages: ConversationMessage[];
  events: TimelineEvent[];
  attachments: Attachment[];
  suggestions: AiSuggestion[];
  escalations: Escalation[];
  staff: Staff[];
  memberHistory: HistoryTicket[];
  currentUserId: string;
  currentUserRole: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<'conversation' | 'history' | 'files'>('conversation');
  const [saving, setSaving] = useState<string | null>(null);
  const [draftToLoad, setDraftToLoad] = useState<string | null>(null);

  const isClosed = ticket.status === 'CLOSED';
  const openEscalations = escalations.filter((e) => e.status === 'OPEN');

  async function updateField(field: string, value: string | null) {
    setSaving(field);
    try {
      await apiFetch(`/api/tickets/${ticket.id}`, {
        method: 'PATCH',
        body: { [field]: value },
      });
      toast.success('Ticket updated.');
      router.refresh();
    } catch (caught) {
      toast.error('Could not update the ticket', errorMessage(caught));
    } finally {
      setSaving(null);
    }
  }

  async function acknowledgeEscalation(escalationId: string, action: 'acknowledge' | 'resolve') {
    setSaving(escalationId);
    try {
      await apiFetch(`/api/escalations/${escalationId}`, { method: 'PATCH', body: { action } });
      toast.success(action === 'resolve' ? 'Escalation resolved.' : 'Escalation acknowledged.');
      router.refresh();
    } catch (caught) {
      toast.error('Could not update the escalation', errorMessage(caught));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {/* Main column */}
      <div className="space-y-4 xl:col-span-2">
        {openEscalations.length > 0 && (
          <Alert
            tone="error"
            title={`${openEscalations.length} open escalation${openEscalations.length === 1 ? '' : 's'}`}
          >
            <ul className="mt-1 space-y-2">
              {openEscalations.map((escalation) => (
                <li key={escalation.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm">
                    <strong>Level {escalation.level}</strong> ·{' '}
                    {escalation.reason.replace(/_/g, ' ').toLowerCase()} — {escalation.detail}
                    {escalation.slackNotified ? (
                      <span className="ml-1 text-xs opacity-80">(Slack notified)</span>
                    ) : (
                      <span className="ml-1 text-xs opacity-80">
                        (Slack not sent{escalation.slackError ? `: ${escalation.slackError}` : ''})
                      </span>
                    )}
                  </span>
                  <span className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => acknowledgeEscalation(escalation.id, 'acknowledge')}
                      disabled={saving === escalation.id}
                      className="rounded-md border border-current px-2 py-0.5 text-xs font-medium disabled:opacity-60"
                    >
                      Acknowledge
                    </button>
                    <button
                      type="button"
                      onClick={() => acknowledgeEscalation(escalation.id, 'resolve')}
                      disabled={saving === escalation.id}
                      className="rounded-md border border-current px-2 py-0.5 text-xs font-medium disabled:opacity-60"
                    >
                      Resolve
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </Alert>
        )}

        <Card>
          <div className="border-b border-line px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xs text-muted">Ticket #{ticket.number}</p>
                <h1 className="mt-1 text-lg font-semibold leading-snug text-ink">{ticket.subject}</h1>
                <p className="mt-1 text-xs text-muted">
                  Opened {relativeTime(ticket.createdAt)} · Updated {relativeTime(ticket.updatedAt)}
                  {ticket.reopenCount > 0 && ` · Reopened ${ticket.reopenCount}×`}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
              </div>
            </div>
          </div>

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
              canPostInternalNote
              disabled={isClosed}
              disabledReason="This ticket is closed. Reopen it to reply."
              draftText={draftToLoad}
              onDraftConsumed={() => setDraftToLoad(null)}
              onMessageSent={() => router.refresh()}
            />
          )}

          {tab === 'history' && <TicketTimeline events={events} />}

          {tab === 'files' && (
            <div className="px-4 py-4 sm:px-5">
              {attachments.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">No files attached to this ticket.</p>
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
                              {formatBytes(attachment.sizeBytes)} · {attachment.uploader?.name ?? 'unknown'} ·{' '}
                              {relativeTime(attachment.createdAt)}
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

        <AiDraftPanel
          ticketId={ticket.id}
          suggestions={suggestions}
          onUseDraft={(text) => {
            setDraftToLoad(text);
            setTab('conversation');
          }}
        />

        <KbLookup initialQuery={`${ticket.subject} ${ticket.body}`.slice(0, 300)} />
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        <Card>
          <CardHeader
            title="Service level"
            icon={<Timer className="h-4 w-4" />}
            description={ticket.slaPolicyName ?? 'Built-in default'}
          />
          <CardBody>
            <SlaSummary sla={ticket.sla} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Triage & routing" />
          <CardBody className="space-y-3">
            <Select
              label="Status"
              value={ticket.status}
              disabled={saving === 'status'}
              onChange={(event) => updateField('status', event.target.value)}
              options={TICKET_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
            />
            <Select
              label="Priority"
              value={ticket.priority}
              disabled={saving === 'priority'}
              onChange={(event) => updateField('priority', event.target.value)}
              options={TICKET_PRIORITIES.map((p) => ({ value: p.value, label: p.label }))}
              hint="Changing priority re-applies the matching SLA policy."
            />
            <Select
              label="Category"
              value={ticket.category}
              disabled={saving === 'category'}
              onChange={(event) => updateField('category', event.target.value)}
              options={TICKET_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
            />
            <Select
              label="Assignee"
              value={ticket.assignee?.id ?? ''}
              disabled={saving === 'assigneeId'}
              onChange={(event) => updateField('assigneeId', event.target.value || null)}
              options={[
                { value: '', label: 'Unassigned' },
                ...staff.map((staff) => ({
                  value: staff.id,
                  label: `${staff.name} — ${staff.openTickets}${
                    staff.maxOpenTickets ? `/${staff.maxOpenTickets}` : ''
                  } open${staff.isAvailable ? '' : ' (away)'}`,
                })),
              ]}
            />
            {ticket.assignee?.id === currentUserId ? (
              <p className="text-xs text-muted">This ticket is assigned to you.</p>
            ) : (
              <button
                type="button"
                onClick={() => updateField('assigneeId', currentUserId)}
                disabled={saving === 'assigneeId'}
                className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-60"
              >
                Assign to me
              </button>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="AI triage result"
            icon={<Bot className="h-4 w-4" />}
            description={ticket.aiEngine === 'OPENAI' ? 'OpenAI model' : 'Local engine'}
          />
          <CardBody className="space-y-3">
            {ticket.aiSummary ? (
              <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-sm leading-relaxed text-ink">
                {ticket.aiSummary}
              </p>
            ) : (
              <p className="text-sm text-muted">This ticket has not been triaged.</p>
            )}

            <div className="flex flex-wrap gap-1.5">
              <CategoryBadge category={ticket.category} />
              {ticket.aiSentiment && <SentimentBadge sentiment={ticket.aiSentiment} />}
              {ticket.aiConfidence !== null && <ConfidenceBadge value={ticket.aiConfidence} />}
              {ticket.autoAssigned && <Badge tone="brand">Auto-assigned</Badge>}
            </div>

            {ticket.aiTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {ticket.aiTags.map((tag) => (
                  <span key={tag} className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <MemberContextPanel
          member={ticket.member}
          showSafetyDetails={ticket.safetyFlag || ticket.category === 'INJURY'}
        />

        {memberHistory.length > 0 && (
          <Card>
            <CardHeader
              title="Previous tickets"
              description={`${memberHistory.length} earlier enquiry(s) from this member`}
            />
            <CardBody className="space-y-1">
              {memberHistory.map((item) => (
                <Link
                  key={item.id}
                  href={`/staff/tickets/${item.id}`}
                  className="block rounded-md px-2 py-1.5 transition-colors hover:bg-surface-2"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-xs text-ink">
                      <span className="font-mono text-muted">#{item.number}</span> {item.subject}
                    </span>
                    <StatusBadge status={item.status} />
                  </span>
                </Link>
              ))}
            </CardBody>
          </Card>
        )}

        {escalations.length > 0 && (
          <Card>
            <CardHeader
              title="Escalation history"
              icon={<AlertTriangle className="h-4 w-4" />}
              description={`${escalations.length} recorded`}
            />
            <CardBody className="space-y-2.5">
              {escalations.map((escalation) => (
                <div key={escalation.id} className="rounded-lg border border-line p-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={escalation.status === 'OPEN' ? 'danger' : 'success'}>
                      {escalation.status.toLowerCase()}
                    </Badge>
                    <span className="text-[11px] text-muted">
                      L{escalation.level} · {relativeTime(escalation.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{escalation.detail}</p>
                  {escalation.acknowledgedBy && (
                    <p className="mt-1 text-[11px] text-muted">
                      Acknowledged by {escalation.acknowledgedBy.name}
                    </p>
                  )}
                </div>
              ))}
            </CardBody>
          </Card>
        )}

        {currentUserRole === 'ADMIN' && (
          <p className="px-1 text-xs text-muted">
            Signed in as an administrator — you can also manage this ticket from the{' '}
            <Link href="/admin/tickets" className="font-medium text-brand-600 hover:underline">
              admin console
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}

export function formatWhen(value: string) {
  return formatDateTime(value);
}

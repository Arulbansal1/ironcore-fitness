import 'server-only';

import type { Ticket, TicketPriority } from '@prisma/client';

import { notifyMany, recordAudit, recordTicketEvent } from './audit';
import { prisma } from './prisma';
import { sendSlackAlert } from './slack';

/** Fallback targets used if an admin deletes a policy row. */
const DEFAULT_TARGETS: Record<TicketPriority, { firstResponseMins: number; resolutionMins: number }> = {
  URGENT: { firstResponseMins: 15, resolutionMins: 240 },
  HIGH: { firstResponseMins: 60, resolutionMins: 480 },
  MEDIUM: { firstResponseMins: 240, resolutionMins: 1440 },
  LOW: { firstResponseMins: 480, resolutionMins: 4320 },
};

export type SlaTargets = {
  policyId: string | null;
  policyName: string;
  firstResponseMins: number;
  resolutionMins: number;
  firstResponseDue: Date;
  resolutionDue: Date;
};

/** Resolves the active SLA policy for a priority and computes absolute deadlines. */
export async function resolveSlaTargets(
  priority: TicketPriority,
  from: Date = new Date(),
): Promise<SlaTargets> {
  const policy = await prisma.slaPolicy.findFirst({
    where: { priority, isActive: true },
  });

  const firstResponseMins = policy?.firstResponseMins ?? DEFAULT_TARGETS[priority].firstResponseMins;
  const resolutionMins = policy?.resolutionMins ?? DEFAULT_TARGETS[priority].resolutionMins;

  return {
    policyId: policy?.id ?? null,
    policyName: policy?.name ?? `${priority} (built-in default)`,
    firstResponseMins,
    resolutionMins,
    firstResponseDue: new Date(from.getTime() + firstResponseMins * 60_000),
    resolutionDue: new Date(from.getTime() + resolutionMins * 60_000),
  };
}

/** Applies (or re-applies, after a priority change) SLA deadlines to a ticket. */
export async function applySla(ticketId: string, priority: TicketPriority, from?: Date) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return null;

  const anchor = from ?? ticket.createdAt;
  const targets = await resolveSlaTargets(priority, anchor);

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      slaPolicyId: targets.policyId,
      // A ticket that already had its first response keeps that clock stopped.
      firstResponseDue: ticket.firstRespondedAt ? ticket.firstResponseDue : targets.firstResponseDue,
      resolutionDue: targets.resolutionDue,
    },
  });

  return targets;
}

// ---------------------------------------------------------------------------
// Live SLA state (used by the UI timers)
// ---------------------------------------------------------------------------

export type SlaClock = {
  label: 'First response' | 'Resolution';
  /** When the clock started (ticket creation) — lets the UI draw the progress bar. */
  startedAt: string | null;
  dueAt: string | null;
  metAt: string | null;
  remainingMs: number | null;
  breached: boolean;
  /** 0-100, how much of the window has elapsed. */
  elapsedPercent: number;
  state: 'met' | 'ok' | 'at_risk' | 'breached' | 'none';
};

export type SlaSnapshot = {
  firstResponse: SlaClock;
  resolution: SlaClock;
  worstState: SlaClock['state'];
};

function buildClock(
  label: SlaClock['label'],
  createdAt: Date,
  dueAt: Date | null,
  metAt: Date | null,
  now: Date,
): SlaClock {
  if (!dueAt) {
    return {
      label,
      startedAt: createdAt.toISOString(),
      dueAt: null,
      metAt: null,
      remainingMs: null,
      breached: false,
      elapsedPercent: 0,
      state: 'none',
    };
  }

  const windowMs = Math.max(dueAt.getTime() - createdAt.getTime(), 1);

  if (metAt) {
    const elapsed = metAt.getTime() - createdAt.getTime();
    return {
      label,
      startedAt: createdAt.toISOString(),
      dueAt: dueAt.toISOString(),
      metAt: metAt.toISOString(),
      remainingMs: dueAt.getTime() - metAt.getTime(),
      breached: metAt > dueAt,
      elapsedPercent: Math.min(100, Math.round((elapsed / windowMs) * 100)),
      state: metAt > dueAt ? 'breached' : 'met',
    };
  }

  const remainingMs = dueAt.getTime() - now.getTime();
  const elapsedPercent = Math.min(100, Math.max(0, Math.round(((now.getTime() - createdAt.getTime()) / windowMs) * 100)));

  let state: SlaClock['state'];
  if (remainingMs <= 0) state = 'breached';
  else if (elapsedPercent >= 75) state = 'at_risk';
  else state = 'ok';

  return {
    label,
    startedAt: createdAt.toISOString(),
    dueAt: dueAt.toISOString(),
    metAt: null,
    remainingMs,
    breached: remainingMs <= 0,
    elapsedPercent,
    state,
  };
}

const STATE_RANK: Record<SlaClock['state'], number> = { none: 0, met: 1, ok: 2, at_risk: 3, breached: 4 };

export function slaSnapshot(
  ticket: Pick<
    Ticket,
    'createdAt' | 'firstResponseDue' | 'resolutionDue' | 'firstRespondedAt' | 'resolvedAt' | 'status'
  >,
  now: Date = new Date(),
): SlaSnapshot {
  const closed = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';
  const firstResponse = buildClock('First response', ticket.createdAt, ticket.firstResponseDue, ticket.firstRespondedAt, now);
  const resolution = buildClock(
    'Resolution',
    ticket.createdAt,
    ticket.resolutionDue,
    ticket.resolvedAt ?? (closed ? new Date() : null),
    now,
  );

  const worstState = STATE_RANK[firstResponse.state] >= STATE_RANK[resolution.state] ? firstResponse.state : resolution.state;
  return { firstResponse, resolution, worstState };
}

export function formatDuration(ms: number): string {
  const abs = Math.abs(ms);
  const minutes = Math.floor(abs / 60_000) % 60;
  const hours = Math.floor(abs / 3_600_000) % 24;
  const days = Math.floor(abs / 86_400_000);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (parts.length < 2) parts.push(`${minutes}m`);

  return parts.slice(0, 2).join(' ');
}

// ---------------------------------------------------------------------------
// Breach sweep — invoked by POST /api/cron/sla-check and the bundled worker
// ---------------------------------------------------------------------------

export type SweepResult = {
  checked: number;
  newEscalations: number;
  slackSent: number;
  slackFailed: number;
  details: Array<{ ticketNumber: number; reason: string; slack: boolean; error?: string }>;
};

/**
 * Scans every open ticket for a missed first-response or resolution deadline,
 * creating one escalation per (ticket, reason, level) and alerting Slack.
 * Safe to run repeatedly: the unique constraint on Escalation prevents repeats.
 */
export async function runSlaSweep(now: Date = new Date()): Promise<SweepResult> {
  const openTickets = await prisma.ticket.findMany({
    where: { status: { in: ['OPEN', 'IN_PROGRESS', 'PENDING_MEMBER'] } },
    include: {
      member: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
      escalations: { select: { reason: true, level: true } },
      slaPolicy: { select: { name: true, notifySlack: true } },
    },
  });

  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true },
  });
  const adminIds = admins.map((a) => a.id);

  const result: SweepResult = {
    checked: openTickets.length,
    newEscalations: 0,
    slackSent: 0,
    slackFailed: 0,
    details: [],
  };

  for (const ticket of openTickets) {
    const breaches: Array<{ reason: 'FIRST_RESPONSE_BREACH' | 'RESOLUTION_BREACH'; due: Date }> = [];

    if (!ticket.firstRespondedAt && ticket.firstResponseDue && ticket.firstResponseDue < now) {
      breaches.push({ reason: 'FIRST_RESPONSE_BREACH', due: ticket.firstResponseDue });
    }
    if (!ticket.resolvedAt && ticket.resolutionDue && ticket.resolutionDue < now) {
      breaches.push({ reason: 'RESOLUTION_BREACH', due: ticket.resolutionDue });
    }

    for (const breach of breaches) {
      const overdueMs = now.getTime() - breach.due.getTime();
      // Escalation level rises the longer a breach goes unresolved: every 2h.
      const level = Math.min(3, 1 + Math.floor(overdueMs / (2 * 60 * 60 * 1000)));
      const already = ticket.escalations.some((e) => e.reason === breach.reason && e.level === level);
      if (already) continue;

      const label =
        breach.reason === 'FIRST_RESPONSE_BREACH' ? 'First response SLA breached' : 'Resolution SLA breached';
      // Always UTC with an explicit marker — a Slack alert is read by people in
      // several timezones, so a bare local timestamp is ambiguous.
      const dueUtc = `${breach.due.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
      const detail = `${label} by ${formatDuration(overdueMs)} (target was ${dueUtc}). Priority ${ticket.priority}, assigned to ${ticket.assignee?.name ?? 'nobody'}.`;

      const escalation = await prisma.escalation.create({
        data: {
          ticketId: ticket.id,
          reason: breach.reason,
          level,
          detail,
          status: 'OPEN',
        },
      });
      result.newEscalations += 1;

      await prisma.ticket.update({
        where: { id: ticket.id },
        data:
          breach.reason === 'FIRST_RESPONSE_BREACH'
            ? { firstResponseBreached: true }
            : { resolutionBreached: true },
      });

      await recordTicketEvent({
        ticketId: ticket.id,
        type: 'escalated',
        summary: `${label} — escalation level ${level}`,
        toValue: `L${level}`,
      });

      await recordAudit({
        action: 'sla.breach',
        entityType: 'Ticket',
        entityId: ticket.id,
        detail,
        metadata: { reason: breach.reason, level, overdueMinutes: Math.round(overdueMs / 60000) },
      });

      // Slack alert
      let slackOk = false;
      let slackError: string | undefined;
      const shouldNotify = ticket.slaPolicy?.notifySlack ?? true;

      if (shouldNotify) {
        const alert = await sendSlackAlert({
          title: `${label} · Level ${level}`,
          severity: level >= 2 ? 'critical' : 'warning',
          ticketId: ticket.id,
          ticketNumber: ticket.number,
          ticketSubject: ticket.subject,
          detail,
          fields: [
            { label: 'Priority', value: ticket.priority },
            { label: 'Status', value: ticket.status.replace(/_/g, ' ') },
            { label: 'Member', value: `${ticket.member.name} (${ticket.member.email})` },
            { label: 'Assignee', value: ticket.assignee ? ticket.assignee.name : '_unassigned_' },
            { label: 'Overdue by', value: formatDuration(overdueMs) },
            { label: 'SLA policy', value: ticket.slaPolicy?.name ?? 'built-in default' },
          ],
        });
        slackOk = alert.sent;
        slackError = alert.error;
        if (alert.sent) result.slackSent += 1;
        else result.slackFailed += 1;

        await prisma.escalation.update({
          where: { id: escalation.id },
          data: { slackNotified: alert.sent, slackError: alert.error ?? null },
        });
      }

      // In-app notification for the assignee and all admins.
      await notifyMany([...(ticket.assigneeId ? [ticket.assigneeId] : []), ...adminIds], {
        title: `${label}: #${ticket.number}`,
        body: `${ticket.subject} — overdue by ${formatDuration(overdueMs)}.`,
        link: `/staff/tickets/${ticket.id}`,
        level: level >= 2 ? 'critical' : 'warning',
      });

      result.details.push({
        ticketNumber: ticket.number,
        reason: `${breach.reason} L${level}`,
        slack: slackOk,
        error: slackError,
      });
    }
  }

  return result;
}

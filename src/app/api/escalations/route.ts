import { notifyMany, recordAudit, recordTicketEvent } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { ApiError, clientIp, ok, readJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { sendSlackAlert } from '@/lib/slack';
import { manualEscalationSchema } from '@/lib/validation';

export const GET = route(async (request: Request) => {
  await requireUser(['STAFF', 'ADMIN']);

  const url = new URL(request.url);
  const status = url.searchParams.get('status');

  const escalations = await prisma.escalation.findMany({
    where: status && status !== 'ALL' ? { status: status as never } : {},
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
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
  });

  return ok({ escalations });
});

/** Manual escalation raised by a staff, with an immediate Slack alert. */
export const POST = route(async (request: Request) => {
  const user = await requireUser(['STAFF', 'ADMIN']);
  const input = manualEscalationSchema.parse(await readJson(request));

  const ticket = await prisma.ticket.findUnique({
    where: { id: input.ticketId },
    include: {
      member: { select: { name: true, email: true } },
      assignee: { select: { id: true, name: true } },
    },
  });
  if (!ticket) throw ApiError.notFound('That ticket does not exist.');

  const existing = await prisma.escalation.findFirst({
    where: { ticketId: ticket.id, reason: 'MANUAL', status: { not: 'RESOLVED' } },
  });
  if (existing) {
    throw ApiError.conflict('This ticket already has an open manual escalation.');
  }

  // Level rises with the number of manual escalations already raised.
  const priorCount = await prisma.escalation.count({
    where: { ticketId: ticket.id, reason: 'MANUAL' },
  });
  const level = Math.min(3, priorCount + 1);

  const detail = `Manually escalated by ${user.name}: ${input.detail}`;

  const escalation = await prisma.escalation.create({
    data: { ticketId: ticket.id, reason: 'MANUAL', level, detail, status: 'OPEN' },
  });

  const alert = await sendSlackAlert({
    title: `Manual escalation · Level ${level}`,
    severity: level >= 2 ? 'critical' : 'warning',
    ticketId: ticket.id,
    ticketNumber: ticket.number,
    ticketSubject: ticket.subject,
    detail,
    fields: [
      { label: 'Raised by', value: user.name },
      { label: 'Priority', value: ticket.priority },
      { label: 'Status', value: ticket.status.replace(/_/g, ' ') },
      { label: 'Member', value: `${ticket.member.name} (${ticket.member.email})` },
      { label: 'Assignee', value: ticket.assignee?.name ?? '_unassigned_' },
    ],
  });

  await prisma.escalation.update({
    where: { id: escalation.id },
    data: { slackNotified: alert.sent, slackError: alert.error ?? null },
  });

  await recordTicketEvent({
    ticketId: ticket.id,
    actorId: user.id,
    type: 'escalated',
    summary: `Manually escalated to level ${level} by ${user.name}`,
    toValue: `L${level}`,
  });

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'escalation.manual',
    entityType: 'Escalation',
    entityId: escalation.id,
    detail,
    metadata: { ticketId: ticket.id, level, slackSent: alert.sent },
    ip: clientIp(request),
  });

  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true },
  });
  await notifyMany([...admins.map((a) => a.id), ...(ticket.assignee ? [ticket.assignee.id] : [])], {
    title: `Manual escalation on #${ticket.number}`,
    body: input.detail,
    link: `/staff/tickets/${ticket.id}`,
    level: 'critical',
  });

  return ok(
    {
      message: alert.sent
        ? 'Escalation raised and posted to Slack.'
        : `Escalation raised. Slack was not notified${alert.error ? ` (${alert.error})` : ''}.`,
      escalation,
      slackSent: alert.sent,
    },
    201,
  );
});

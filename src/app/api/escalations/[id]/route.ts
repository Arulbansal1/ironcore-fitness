import { recordAudit, recordTicketEvent } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { ApiError, clientIp, ok, readJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { escalationActionSchema } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

/** Acknowledge or resolve an escalation. Agents and admins only. */
export const PATCH = route(async (request: Request, context: Params) => {
  const { id } = await context.params;
  const user = await requireUser(['STAFF', 'ADMIN']);
  const input = escalationActionSchema.parse(await readJson(request));

  const escalation = await prisma.escalation.findUnique({
    where: { id },
    include: { ticket: { select: { id: true, number: true } } },
  });
  if (!escalation) throw ApiError.notFound('That escalation no longer exists.');

  if (escalation.status === 'RESOLVED') {
    throw ApiError.conflict('This escalation is already resolved.');
  }
  if (input.action === 'acknowledge' && escalation.status === 'ACKNOWLEDGED') {
    throw ApiError.conflict('This escalation has already been acknowledged.');
  }

  const updated = await prisma.escalation.update({
    where: { id },
    data:
      input.action === 'acknowledge'
        ? { status: 'ACKNOWLEDGED', acknowledgedById: user.id, acknowledgedAt: new Date() }
        : {
            status: 'RESOLVED',
            resolvedAt: new Date(),
            // Resolving without a prior acknowledgement still records who acted.
            acknowledgedById: escalation.acknowledgedById ?? user.id,
            acknowledgedAt: escalation.acknowledgedAt ?? new Date(),
          },
    include: { acknowledgedBy: { select: { id: true, name: true } } },
  });

  await recordTicketEvent({
    ticketId: escalation.ticketId,
    actorId: user.id,
    type: 'escalated',
    summary: `Escalation level ${escalation.level} ${input.action === 'resolve' ? 'resolved' : 'acknowledged'} by ${user.name}`,
    fromValue: escalation.status,
    toValue: updated.status,
  });

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: `escalation.${input.action}`,
    entityType: 'Escalation',
    entityId: id,
    detail: `Ticket #${escalation.ticket.number}: escalation L${escalation.level} ${updated.status.toLowerCase()}.`,
    metadata: { ticketId: escalation.ticketId, reason: escalation.reason, level: escalation.level },
    ip: clientIp(request),
  });

  return ok({
    message: input.action === 'resolve' ? 'Escalation resolved.' : 'Escalation acknowledged.',
    escalation: updated,
  });
});

import { recordAudit, recordTicketEvent } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { ApiError, ok, readJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { getTicketForUser } from '@/lib/tickets';
import { csatSchema } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

/** Member satisfaction rating (1-5), only on a resolved or closed ticket. */
export const POST = route(async (request: Request, context: Params) => {
  const { id } = await context.params;
  const user = await requireUser(['MEMBER']);
  const input = csatSchema.parse(await readJson(request));

  const ticket = await getTicketForUser(id, user);

  if (ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED') {
    throw ApiError.badRequest('You can rate a ticket once it has been resolved.');
  }
  if (ticket.satisfaction !== null) {
    throw ApiError.conflict('You have already rated this ticket.');
  }

  await prisma.ticket.update({ where: { id }, data: { satisfaction: input.rating } });

  await recordTicketEvent({
    ticketId: id,
    actorId: user.id,
    type: 'rated',
    summary: `Member rated this ticket ${input.rating}/5`,
    toValue: String(input.rating),
  });

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'ticket.rated',
    entityType: 'Ticket',
    entityId: id,
    detail: `Rated ${input.rating}/5`,
    metadata: { rating: input.rating },
  });

  // Let the staff who handled it know.
  if (ticket.assigneeId) {
    await prisma.notification.create({
      data: {
        userId: ticket.assigneeId,
        title: `Ticket #${ticket.number} rated ${input.rating}/5`,
        body: ticket.subject,
        link: `/staff/tickets/${ticket.id}`,
        level: input.rating <= 2 ? 'warning' : 'info',
      },
    });
  }

  return ok({ message: 'Thanks for the feedback.', rating: input.rating });
});

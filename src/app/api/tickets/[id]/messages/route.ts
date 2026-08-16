import { notify, recordAudit, recordTicketEvent } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { sendEmail, ticketReplyEmail } from '@/lib/email';
import { ApiError, clientIp, ok, readJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { getTicketForUser } from '@/lib/tickets';
import { checkSentimentEscalation } from '@/lib/triage';
import { createMessageSchema } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

/** Conversation for a ticket. Polled by the chat panel for near-live updates. */
export const GET = route(async (request: Request, context: Params) => {
  const { id } = await context.params;
  const user = await requireUser();
  await getTicketForUser(id, user);

  const isStaff = user.role === 'STAFF' || user.role === 'ADMIN';
  const url = new URL(request.url);
  const since = url.searchParams.get('since');

  const messages = await prisma.message.findMany({
    where: {
      ticketId: id,
      ...(isStaff ? {} : { isInternal: false }),
      ...(since ? { createdAt: { gt: new Date(since) } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    include: {
      author: { select: { id: true, name: true, role: true, avatarColor: true } },
      attachments: { select: { id: true, filename: true, mimeType: true, sizeBytes: true } },
    },
  });

  return ok({ messages, serverTime: new Date().toISOString() });
});

/** Posts a reply (or, for staff, an internal note). */
export const POST = route(async (request: Request, context: Params) => {
  const { id } = await context.params;
  const user = await requireUser();
  const input = createMessageSchema.parse(await readJson(request));

  const ticket = await getTicketForUser(id, user);
  const isStaff = user.role === 'STAFF' || user.role === 'ADMIN';

  if (input.isInternal && !isStaff) {
    throw ApiError.forbidden('Only staff can post internal notes.');
  }
  if (ticket.status === 'CLOSED') {
    throw ApiError.badRequest('This ticket is closed. Reopen it before adding a reply.');
  }

  const message = await prisma.message.create({
    data: {
      ticketId: id,
      authorId: user.id,
      authorType: isStaff ? 'STAFF' : 'MEMBER',
      body: input.body,
      isInternal: input.isInternal ?? false,
      fromAiDraftId: input.fromAiDraftId ?? null,
    },
    include: {
      author: { select: { id: true, name: true, role: true, avatarColor: true } },
      attachments: { select: { id: true, filename: true, mimeType: true, sizeBytes: true } },
    },
  });

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  // The first public staff reply stops the first-response SLA clock.
  if (isStaff && !input.isInternal && !ticket.firstRespondedAt) {
    updates.firstRespondedAt = new Date();
    updates.firstResponseBreached = ticket.firstResponseDue
      ? new Date() > ticket.firstResponseDue
      : false;

    await recordTicketEvent({
      ticketId: id,
      actorId: user.id,
      type: 'first_response',
      summary: `First response sent by ${user.name}${
        ticket.firstResponseDue && new Date() > ticket.firstResponseDue ? ' (after SLA target)' : ' (within SLA)'
      }`,
    });
  }

  // Move status along automatically so staff don't have to babysit it.
  if (!input.isInternal) {
    if (isStaff && ticket.status === 'OPEN') updates.status = 'IN_PROGRESS';
    else if (isStaff && ticket.status === 'IN_PROGRESS') updates.status = 'PENDING_MEMBER';
    else if (!isStaff && (ticket.status === 'PENDING_MEMBER' || ticket.status === 'RESOLVED')) {
      updates.status = 'IN_PROGRESS';
      if (ticket.status === 'RESOLVED') {
        updates.resolvedAt = null;
        updates.reopenCount = ticket.reopenCount + 1;
        await recordTicketEvent({
          ticketId: id,
          actorId: user.id,
          type: 'reopened',
          summary: 'Member replied on a resolved ticket — reopened',
        });
      }
    }
  }

  await prisma.ticket.update({ where: { id }, data: updates });

  // A member reply with strong negative language raises an escalation.
  if (!isStaff) {
    const escalation = await checkSentimentEscalation(ticket, input.body);
    if (escalation) {
      await recordTicketEvent({
        ticketId: id,
        type: 'escalated',
        summary: 'Negative sentiment detected in a member message — flagged for senior review',
      });
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN', isActive: true },
        select: { id: true },
      });
      for (const admin of [...admins.map((a) => a.id), ...(ticket.assigneeId ? [ticket.assigneeId] : [])]) {
        await notify({
          userId: admin,
          title: `Negative sentiment on #${ticket.number}`,
          body: ticket.subject,
          link: `/staff/tickets/${ticket.id}`,
          level: 'warning',
        });
      }
    }
  }

  // Notify the other side (never for internal notes).
  if (!input.isInternal) {
    if (isStaff) {
      await notify({
        userId: ticket.memberId,
        title: `New reply on ticket #${ticket.number}`,
        body: input.body.slice(0, 140),
        link: `/member/tickets/${ticket.id}`,
      });
      // Best-effort email; a delivery failure must not fail the reply.
      sendEmail({
        to: { email: ticket.member.email, name: ticket.member.name },
        ...ticketReplyEmail(ticket.member.name, ticket.number, ticket.subject, input.body.slice(0, 300)),
      }).catch((error) => console.error('[messages] reply email failed', error));
    } else if (ticket.assigneeId) {
      await notify({
        userId: ticket.assigneeId,
        title: `Member replied on #${ticket.number}`,
        body: input.body.slice(0, 140),
        link: `/staff/tickets/${ticket.id}`,
      });
    }
  }

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: input.isInternal ? 'ticket.internal_note' : 'ticket.reply',
    entityType: 'Ticket',
    entityId: id,
    detail: `#${ticket.number} — ${input.body.slice(0, 120)}`,
    metadata: { fromAiDraft: Boolean(input.fromAiDraftId) },
    ip: clientIp(request),
  });

  return ok({ message: 'Message sent.', data: message }, 201);
});

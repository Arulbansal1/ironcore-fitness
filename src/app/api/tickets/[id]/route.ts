import { notify, recordAudit, recordTicketEvent } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { ApiError, clientIp, ok, readJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { applySla, slaSnapshot } from '@/lib/sla';
import { canEditTicket, getTicketForUser, statusLabel } from '@/lib/tickets';
import { updateTicketSchema } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

/** Full ticket detail: conversation, attachments, AI suggestions and history. */
export const GET = route(async (request: Request, context: Params) => {
  const { id } = await context.params;
  const user = await requireUser();
  const ticket = await getTicketForUser(id, user);

  const isStaff = user.role === 'STAFF' || user.role === 'ADMIN';

  const [messages, attachments, suggestions, events, escalations] = await Promise.all([
    prisma.message.findMany({
      // Members never see internal staff notes.
      where: { ticketId: id, ...(isStaff ? {} : { isInternal: false }) },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { id: true, name: true, role: true, avatarColor: true } },
        attachments: {
          select: { id: true, filename: true, mimeType: true, sizeBytes: true, createdAt: true },
        },
      },
    }),
    prisma.attachment.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
        uploader: { select: { id: true, name: true } },
      },
    }),
    isStaff
      ? prisma.aiSuggestion.findMany({
          where: { ticketId: id },
          orderBy: { createdAt: 'desc' },
          include: { reviewedBy: { select: { id: true, name: true } } },
        })
      : Promise.resolve([]),
    prisma.ticketEvent.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: 'asc' },
      include: { actor: { select: { id: true, name: true, role: true } } },
    }),
    prisma.escalation.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: 'desc' },
      include: { acknowledgedBy: { select: { id: true, name: true } } },
    }),
  ]);

  return ok({
    ticket: {
      ...ticket,
      sla: slaSnapshot(ticket),
    },
    messages,
    attachments,
    suggestions,
    events,
    escalations,
    permissions: {
      canEdit: canEditTicket(user.role),
      canReply: true,
      canPostInternalNote: isStaff,
      canReopen: ticket.status === 'RESOLVED' || ticket.status === 'CLOSED',
      canRate: user.role === 'MEMBER' && (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'),
    },
  });
});

/** Status / priority / category / assignee changes — staff and admins only. */
export const PATCH = route(async (request: Request, context: Params) => {
  const { id } = await context.params;
  const user = await requireUser();
  const input = updateTicketSchema.parse(await readJson(request));

  const ticket = await getTicketForUser(id, user);

  // Members may only close or reopen their own ticket, nothing else.
  const isStaff = canEditTicket(user.role);
  if (!isStaff) {
    const onlyStatus = Object.keys(input).length === 1 && input.status !== undefined;
    const allowed = input.status === 'CLOSED' || input.status === 'OPEN';
    if (!onlyStatus || !allowed) {
      throw ApiError.forbidden('You can only close or reopen your own ticket.');
    }
  }

  const data: Record<string, unknown> = {};
  const events: Array<{ type: string; summary: string; fromValue?: string; toValue?: string }> = [];

  if (input.status && input.status !== ticket.status) {
    data.status = input.status;
    if (input.status === 'RESOLVED') {
      data.resolvedAt = new Date();
    } else if (input.status === 'CLOSED') {
      data.closedAt = new Date();
      data.resolvedAt = ticket.resolvedAt ?? new Date();
    } else if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
      // Reopening restarts the resolution clock and bumps the reopen counter.
      data.resolvedAt = null;
      data.closedAt = null;
      data.reopenCount = ticket.reopenCount + 1;
    }
    events.push({
      type: 'status_changed',
      summary: `Status changed from ${statusLabel(ticket.status)} to ${statusLabel(input.status)}`,
      fromValue: ticket.status,
      toValue: input.status,
    });
  }

  if (input.priority && input.priority !== ticket.priority) {
    data.priority = input.priority;
    events.push({
      type: 'priority_changed',
      summary: `Priority changed from ${ticket.priority.toLowerCase()} to ${input.priority.toLowerCase()}`,
      fromValue: ticket.priority,
      toValue: input.priority,
    });
  }

  if (input.category && input.category !== ticket.category) {
    data.category = input.category;
    events.push({
      type: 'category_changed',
      summary: `Category changed to ${input.category.replace(/_/g, ' ').toLowerCase()}`,
      fromValue: ticket.category,
      toValue: input.category,
    });
  }

  if (input.assigneeId !== undefined && input.assigneeId !== ticket.assigneeId) {
    if (input.assigneeId === null) {
      data.assigneeId = null;
      data.autoAssigned = false;
      events.push({ type: 'assigned', summary: 'Ticket unassigned', fromValue: ticket.assigneeId ?? undefined });
    } else {
      const assignee = await prisma.user.findFirst({
        where: { id: input.assigneeId, role: { in: ['STAFF', 'ADMIN'] }, isActive: true },
        select: { id: true, name: true },
      });
      if (!assignee) throw ApiError.badRequest('That staff does not exist or is not active.');

      data.assigneeId = assignee.id;
      data.autoAssigned = false;
      events.push({
        type: 'assigned',
        summary: `Assigned to ${assignee.name} by ${user.name}`,
        toValue: assignee.name,
      });

      await notify({
        userId: assignee.id,
        title: `Ticket #${ticket.number} assigned to you`,
        body: ticket.subject,
        link: `/staff/tickets/${ticket.id}`,
      });
    }
  }

  if (Object.keys(data).length === 0) {
    return ok({ message: 'No changes to apply.', ticket: { ...ticket, sla: slaSnapshot(ticket) } });
  }

  const updated = await prisma.ticket.update({
    where: { id },
    data,
    include: {
      member: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarColor: true,
          phone: true,
          memberProfile: true,
        },
      },
      assignee: { select: { id: true, name: true, email: true, avatarColor: true } },
      slaPolicy: true,
    },
  });

  // A priority change moves the SLA deadlines with it.
  if (input.priority && input.priority !== ticket.priority) {
    await applySla(id, input.priority, ticket.createdAt);
  }

  for (const event of events) {
    await recordTicketEvent({ ticketId: id, actorId: user.id, ...event });
  }

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'ticket.updated',
    entityType: 'Ticket',
    entityId: id,
    detail: events.map((e) => e.summary).join('; '),
    metadata: { changes: data as Record<string, never> },
    ip: clientIp(request),
  });

  // Keep the member informed about meaningful state changes.
  if (input.status && ticket.memberId !== user.id) {
    await notify({
      userId: ticket.memberId,
      title: `Ticket #${ticket.number} is now ${statusLabel(input.status).toLowerCase()}`,
      body: ticket.subject,
      link: `/member/tickets/${ticket.id}`,
    });
  }

  const refreshed = await prisma.ticket.findUniqueOrThrow({ where: { id } });

  return ok({
    message: 'Ticket updated.',
    ticket: { ...updated, sla: slaSnapshot(refreshed) },
  });
});

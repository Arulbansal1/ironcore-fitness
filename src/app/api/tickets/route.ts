import { recordAudit, recordTicketEvent } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { clientIp, ok, readJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { listTickets, serializeTicket, ticketListSelect } from '@/lib/tickets';
import { runTriagePipeline } from '@/lib/triage';
import { createTicketSchema } from '@/lib/validation';

function splitParam(value: string | null): string[] | undefined {
  if (!value) return undefined;
  const parts = value.split(',').map((v) => v.trim().toUpperCase()).filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

export const GET = route(async (request: Request) => {
  const user = await requireUser();
  const url = new URL(request.url);
  const params = url.searchParams;

  const result = await listTickets({
    user,
    status: splitParam(params.get('status')),
    priority: splitParam(params.get('priority')),
    category: splitParam(params.get('category')),
    assigneeId: params.get('assigneeId') ?? undefined,
    memberId: params.get('memberId') ?? undefined,
    search: params.get('search') ?? undefined,
    breachedOnly: params.get('breached') === 'true',
    unassignedOnly: params.get('unassigned') === 'true',
    sort: (params.get('sort') as 'newest' | 'oldest' | 'priority' | 'sla' | null) ?? 'newest',
    page: Number(params.get('page')) || 1,
    pageSize: Number(params.get('pageSize')) || 20,
  });

  return ok(result);
});

export const POST = route(async (request: Request) => {
  const user = await requireUser();
  const input = createTicketSchema.parse(await readJson(request));

  const ticket = await prisma.ticket.create({
    data: {
      subject: input.subject,
      body: input.body,
      memberId: user.id,
      // A member's own choices are a starting point; AI triage refines them.
      category: input.category ?? 'GENERAL',
      priority: input.priority ?? 'MEDIUM',
      status: 'OPEN',
    },
  });

  await prisma.message.create({
    data: {
      ticketId: ticket.id,
      authorId: user.id,
      authorType: 'MEMBER',
      body: input.body,
    },
  });

  await recordTicketEvent({
    ticketId: ticket.id,
    actorId: user.id,
    type: 'created',
    summary: `Ticket created by ${user.name}`,
  });

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'ticket.created',
    entityType: 'Ticket',
    entityId: ticket.id,
    detail: `#${ticket.number} — ${ticket.subject}`,
    metadata: { category: ticket.category, priority: ticket.priority },
    ip: clientIp(request),
  });

  // Triage runs inline so the member immediately sees the classification,
  // SLA target and assigned staff. Failures never block ticket creation.
  let triageError: string | null = null;
  try {
    await runTriagePipeline(ticket.id);
  } catch (error) {
    console.error('[tickets] triage pipeline failed', error);
    triageError = 'Automatic triage could not run. A staff will classify this ticket manually.';
  }

  const fresh = await prisma.ticket.findUniqueOrThrow({
    where: { id: ticket.id },
    select: ticketListSelect,
  });

  return ok(
    {
      message: `Ticket #${fresh.number} created.`,
      ticket: serializeTicket(fresh),
      triageError,
    },
    201,
  );
});

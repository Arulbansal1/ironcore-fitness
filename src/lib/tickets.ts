import 'server-only';

import type { Prisma, Role } from '@prisma/client';

import type { SessionUser } from './auth';
import { ApiError } from './http';
import { prisma } from './prisma';
import { slaSnapshot, type SlaSnapshot } from './sla';

/**
 * Row shape shared by every ticket list in the app so the member, staff and
 * admin tables stay consistent.
 */
export const ticketListSelect = {
  id: true,
  number: true,
  subject: true,
  status: true,
  priority: true,
  category: true,
  aiSummary: true,
  aiSentiment: true,
  aiConfidence: true,
  aiTags: true,
  createdAt: true,
  updatedAt: true,
  firstResponseDue: true,
  resolutionDue: true,
  firstRespondedAt: true,
  resolvedAt: true,
  satisfaction: true,
  autoAssigned: true,
  safetyFlag: true,
  member: {
    select: {
      id: true,
      name: true,
      email: true,
      avatarColor: true,
      memberProfile: { select: { tier: true, status: true, memberNumber: true } },
    },
  },
  assignee: { select: { id: true, name: true, email: true, avatarColor: true } },
  _count: { select: { messages: true, attachments: true, escalations: true } },
} satisfies Prisma.TicketSelect;

export type TicketListRow = Prisma.TicketGetPayload<{ select: typeof ticketListSelect }>;

export type SerializedTicket = Omit<
  TicketListRow,
  'createdAt' | 'updatedAt' | 'firstResponseDue' | 'resolutionDue' | 'firstRespondedAt' | 'resolvedAt'
> & {
  createdAt: string;
  updatedAt: string;
  sla: SlaSnapshot;
};

/** Adds the live SLA snapshot and converts dates to ISO strings for the client. */
export function serializeTicket(ticket: TicketListRow): SerializedTicket {
  const { firstResponseDue, resolutionDue, firstRespondedAt, resolvedAt, ...rest } = ticket;

  return {
    ...rest,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    sla: slaSnapshot({
      createdAt: ticket.createdAt,
      firstResponseDue,
      resolutionDue,
      firstRespondedAt,
      resolvedAt,
      status: ticket.status,
    }),
  };
}

/**
 * Restricts a ticket query to what the caller may see:
 *   CUSTOMER → only their own tickets
 *   AGENT    → every ticket (they can pick up unassigned work)
 *   ADMIN    → every ticket
 */
export function visibilityFilter(user: SessionUser): Prisma.TicketWhereInput {
  if (user.role === 'MEMBER') return { memberId: user.id };
  return {};
}

/** Loads a ticket, enforcing the caller's visibility rules. */
export async function getTicketForUser(ticketId: string, user: SessionUser) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
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

  if (!ticket) throw ApiError.notFound('That ticket does not exist.');
  if (user.role === 'MEMBER' && ticket.memberId !== user.id) {
    // 404 rather than 403 so a member cannot probe for other tickets' existence.
    throw ApiError.notFound('That ticket does not exist.');
  }

  return ticket;
}

export function canEditTicket(role: Role) {
  return role === 'STAFF' || role === 'ADMIN';
}

/** Human-readable label used in timeline entries and Slack alerts. */
export function statusLabel(status: string) {
  return status
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

type ListParams = {
  user: SessionUser;
  status?: string[];
  priority?: string[];
  category?: string[];
  assigneeId?: string;
  memberId?: string;
  search?: string;
  breachedOnly?: boolean;
  unassignedOnly?: boolean;
  sort?: 'newest' | 'oldest' | 'priority' | 'sla';
  page?: number;
  pageSize?: number;
};

const PRIORITY_ORDER: Prisma.TicketOrderByWithRelationInput[] = [
  { priority: 'desc' },
  { createdAt: 'asc' },
];

/** Shared, filterable ticket list used by all three dashboards. */
export async function listTickets(params: ListParams) {
  const page = Math.max(params.page ?? 1, 1);
  const pageSize = Math.min(Math.max(params.pageSize ?? 20, 1), 100);

  const where: Prisma.TicketWhereInput = { ...visibilityFilter(params.user) };
  const and: Prisma.TicketWhereInput[] = [];

  if (params.status?.length) and.push({ status: { in: params.status as never[] } });
  if (params.priority?.length) and.push({ priority: { in: params.priority as never[] } });
  if (params.category?.length) and.push({ category: { in: params.category as never[] } });
  if (params.assigneeId === 'unassigned' || params.unassignedOnly) and.push({ assigneeId: null });
  else if (params.assigneeId) and.push({ assigneeId: params.assigneeId });
  if (params.memberId) and.push({ memberId: params.memberId });

  if (params.breachedOnly) {
    and.push({ OR: [{ firstResponseBreached: true }, { resolutionBreached: true }] });
  }

  if (params.search?.trim()) {
    const term = params.search.trim();
    const asNumber = Number(term.replace('#', ''));
    and.push({
      OR: [
        { subject: { contains: term, mode: 'insensitive' } },
        { body: { contains: term, mode: 'insensitive' } },
        { aiSummary: { contains: term, mode: 'insensitive' } },
        ...(Number.isInteger(asNumber) && asNumber > 0 ? [{ number: asNumber }] : []),
        ...(params.user.role !== 'MEMBER'
          ? [
              { member: { name: { contains: term, mode: 'insensitive' as const } } },
              { member: { email: { contains: term, mode: 'insensitive' as const } } },
            ]
          : []),
      ],
    });
  }

  if (and.length > 0) where.AND = and;

  const orderBy: Prisma.TicketOrderByWithRelationInput[] =
    params.sort === 'oldest'
      ? [{ createdAt: 'asc' }]
      : params.sort === 'priority'
        ? PRIORITY_ORDER
        : params.sort === 'sla'
          ? [{ firstResponseDue: 'asc' }, { createdAt: 'asc' }]
          : [{ createdAt: 'desc' }];

  const [rows, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      select: ticketListSelect,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.ticket.count({ where }),
  ]);

  return {
    tickets: rows.map(serializeTicket),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

/** Counts used by the dashboard stat tiles. */
export async function ticketCounts(where: Prisma.TicketWhereInput = {}) {
  const [total, open, inProgress, pending, resolved, closed, breached, unassigned] = await Promise.all([
    prisma.ticket.count({ where }),
    prisma.ticket.count({ where: { ...where, status: 'OPEN' } }),
    prisma.ticket.count({ where: { ...where, status: 'IN_PROGRESS' } }),
    prisma.ticket.count({ where: { ...where, status: 'PENDING_MEMBER' } }),
    prisma.ticket.count({ where: { ...where, status: 'RESOLVED' } }),
    prisma.ticket.count({ where: { ...where, status: 'CLOSED' } }),
    prisma.ticket.count({
      where: {
        ...where,
        OR: [{ firstResponseBreached: true }, { resolutionBreached: true }],
        status: { in: ['OPEN', 'IN_PROGRESS', 'PENDING_MEMBER'] },
      },
    }),
    prisma.ticket.count({
      where: { ...where, assigneeId: null, status: { in: ['OPEN', 'IN_PROGRESS'] } },
    }),
  ]);

  return {
    total,
    open,
    inProgress,
    pending,
    resolved,
    closed,
    breached,
    unassigned,
    active: open + inProgress + pending,
  };
}

import 'server-only';

import type { Prisma } from '@prisma/client';

import { prisma } from './prisma';

type AuditArgs = {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  detail?: string;
  metadata?: Prisma.InputJsonValue;
  ip?: string | null;
};

/**
 * Appends an immutable audit record. Never throws — an audit failure must not
 * roll back the user-facing action it describes.
 */
export async function recordAudit(args: AuditArgs): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: args.actorId ?? null,
        actorEmail: args.actorEmail ?? null,
        action: args.action,
        entityType: args.entityType,
        entityId: args.entityId ?? null,
        detail: args.detail ?? null,
        metadata: args.metadata ?? {},
        ip: args.ip ?? null,
      },
    });
  } catch (error) {
    console.error('[audit] failed to record', args.action, error);
  }
}

type TicketEventArgs = {
  ticketId: string;
  actorId?: string | null;
  type: string;
  summary: string;
  fromValue?: string | null;
  toValue?: string | null;
};

/** Appends an entry to a ticket's visible activity timeline. */
export async function recordTicketEvent(args: TicketEventArgs): Promise<void> {
  try {
    await prisma.ticketEvent.create({
      data: {
        ticketId: args.ticketId,
        actorId: args.actorId ?? null,
        type: args.type,
        summary: args.summary,
        fromValue: args.fromValue ?? null,
        toValue: args.toValue ?? null,
      },
    });
  } catch (error) {
    console.error('[ticket-event] failed to record', args.type, error);
  }
}

type NotifyArgs = {
  userId: string;
  title: string;
  body: string;
  link?: string;
  level?: 'info' | 'warning' | 'critical';
};

export async function notify(args: NotifyArgs): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: args.userId,
        title: args.title,
        body: args.body,
        link: args.link,
        level: args.level ?? 'info',
      },
    });
  } catch (error) {
    console.error('[notification] failed to create', error);
  }
}

export async function notifyMany(userIds: string[], args: Omit<NotifyArgs, 'userId'>) {
  const unique = [...new Set(userIds)];
  await Promise.all(unique.map((userId) => notify({ ...args, userId })));
}

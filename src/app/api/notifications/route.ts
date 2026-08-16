import { z } from 'zod';

import { requireUser } from '@/lib/auth';
import { ok, readJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';

export const GET = route(async () => {
  const user = await requireUser();

  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  return ok({ notifications, unread });
});

const patchSchema = z.object({
  action: z.enum(['mark_all_read', 'mark_read']),
  id: z.string().optional(),
});

export const PATCH = route(async (request: Request) => {
  const user = await requireUser();
  const input = patchSchema.parse(await readJson(request));

  if (input.action === 'mark_all_read') {
    const result = await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return ok({ message: `Marked ${result.count} notification(s) as read.`, unread: 0 });
  }

  if (!input.id) {
    return ok({ message: 'Nothing to update.', unread: await countUnread(user.id) });
  }

  // Scoped by userId so one user can never mark another's notification.
  await prisma.notification.updateMany({
    where: { id: input.id, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  return ok({ message: 'Marked as read.', unread: await countUnread(user.id) });
});

function countUnread(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

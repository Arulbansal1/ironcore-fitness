import { getSession } from '@/lib/auth';
import { integrationStatus } from '@/lib/env';
import { ok, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';

/** Current session + unread notification count, used by the app shell. */
export const GET = route(async () => {
  const user = await getSession();
  if (!user) return ok({ user: null });

  const unreadNotifications = await prisma.notification.count({
    where: { userId: user.id, readAt: null },
  });

  return ok({
    user,
    unreadNotifications,
    integrations: integrationStatus(),
  });
});

import { recordAudit } from '@/lib/audit';
import { clearSessionCookie, getSession } from '@/lib/auth';
import { clientIp, ok, route } from '@/lib/http';

export const POST = route(async (request: Request) => {
  const user = await getSession();
  await clearSessionCookie();

  if (user) {
    await recordAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'auth.logout',
      entityType: 'User',
      entityId: user.id,
      ip: clientIp(request),
    });
  }

  return ok({ message: 'Signed out.' });
});

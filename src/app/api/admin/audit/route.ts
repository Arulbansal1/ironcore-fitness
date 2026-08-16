import { requireUser } from '@/lib/auth';
import { ok, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export const GET = route(async (request: Request) => {
  await requireUser(['ADMIN']);

  const params = new URL(request.url).searchParams;
  const action = params.get('action');
  const entityType = params.get('entityType');
  const search = params.get('search')?.trim();
  const page = Math.max(Number(params.get('page')) || 1, 1);
  const pageSize = Math.min(Math.max(Number(params.get('pageSize')) || 50, 1), 200);

  const where = {
    ...(action && action !== 'ALL' ? { action } : {}),
    ...(entityType && entityType !== 'ALL' ? { entityType } : {}),
    ...(search
      ? {
          OR: [
            { detail: { contains: search, mode: 'insensitive' as const } },
            { actorEmail: { contains: search, mode: 'insensitive' as const } },
            { action: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [logs, total, actions, entityTypes] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { actor: { select: { id: true, name: true, role: true, avatarColor: true } } },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({ by: ['action'], _count: true, orderBy: { action: 'asc' } }),
    prisma.auditLog.groupBy({ by: ['entityType'], _count: true, orderBy: { entityType: 'asc' } }),
  ]);

  return ok({
    logs,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    facets: {
      actions: actions.map((a) => ({ value: a.action, count: a._count })),
      entityTypes: entityTypes.map((e) => ({ value: e.entityType, count: e._count })),
    },
  });
});

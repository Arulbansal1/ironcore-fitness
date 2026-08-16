import { requireUser } from '@/lib/auth';
import { ok, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';

export const GET = route(async (request: Request) => {
  await requireUser(['ADMIN']);

  const url = new URL(request.url);
  const role = url.searchParams.get('role');
  const search = url.searchParams.get('search')?.trim();

  const users = await prisma.user.findMany({
    where: {
      ...(role && role !== 'ALL' ? { role: role as never } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      emailVerified: true,
      avatarColor: true,
      lastLoginAt: true,
      createdAt: true,
      staffProfile: {
        select: { title: true, specialties: true, maxOpenTickets: true, isAvailable: true },
      },
      _count: {
        select: {
          ticketsAsMember: true,
          ticketsAsOwner: true,
        },
      },
    },
  });

  const counts = await prisma.user.groupBy({ by: ['role'], _count: true });

  return ok({
    users,
    counts: Object.fromEntries(counts.map((c) => [c.role, c._count])),
  });
});

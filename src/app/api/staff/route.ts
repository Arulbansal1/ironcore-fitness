import { requireUser } from '@/lib/auth';
import { ok, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';

/** Assignable staff with their current workload — powers the assignee picker. */
export const GET = route(async () => {
  await requireUser(['STAFF', 'ADMIN']);

  const staff = await prisma.user.findMany({
    where: { role: { in: ['STAFF', 'ADMIN'] }, isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarColor: true,
      staffProfile: {
        select: { title: true, specialties: true, maxOpenTickets: true, isAvailable: true },
      },
      _count: {
        select: {
          ticketsAsOwner: {
            where: { status: { in: ['OPEN', 'IN_PROGRESS', 'PENDING_MEMBER'] } },
          },
        },
      },
    },
  });

  return ok({
    staff: staff.map((staff) => ({
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      avatarColor: staff.avatarColor,
      title: staff.staffProfile?.title ?? (staff.role === 'ADMIN' ? 'Administrator' : 'Support Staff'),
      specialties: staff.staffProfile?.specialties ?? [],
      maxOpenTickets: staff.staffProfile?.maxOpenTickets ?? null,
      isAvailable: staff.staffProfile?.isAvailable ?? true,
      openTickets: staff._count.ticketsAsOwner,
    })),
  });
});

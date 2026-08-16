import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/AppShell';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

import { UsersManager } from './UsersManager';

export const metadata: Metadata = { title: 'Users & staff' };
export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const session = await getSession();

  const [users, counts] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        emailVerified: true,
        avatarColor: true,
        phone: true,
        lastLoginAt: true,
        createdAt: true,
        staffProfile: {
          select: { title: true, specialties: true, maxOpenTickets: true, isAvailable: true },
        },
        _count: { select: { ticketsAsMember: true, ticketsAsOwner: true } },
      },
    }),
    prisma.user.groupBy({ by: ['role'], _count: true }),
  ]);

  return (
    <>
      <PageHeader
        title="Users & staff"
        description="Manage roles, access and staff routing configuration."
      />

      <UsersManager
        currentUserId={session?.id ?? ''}
        counts={Object.fromEntries(counts.map((row) => [row.role, row._count]))}
        users={users.map((user) => ({
          ...user,
          lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
          createdAt: user.createdAt.toISOString(),
        }))}
      />
    </>
  );
}

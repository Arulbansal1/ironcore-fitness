import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/layout/AppShell';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

import { ClassTimetable } from './ClassTimetable';

export const metadata: Metadata = { title: 'Classes' };
export const dynamic = 'force-dynamic';

export default async function ClassesPage() {
  const user = await getSession();
  if (!user) redirect('/login');

  const profile = await prisma.memberProfile.findUnique({
    where: { userId: user.id },
    select: { status: true },
  });

  // Staff and managers can view the timetable but do not hold member bookings.
  const canBook = user.role === 'MEMBER' && profile?.status === 'ACTIVE';

  return (
    <>
      <PageHeader
        title="Class timetable"
        description="Book, waitlist and cancel. Cancel at least four hours ahead to avoid a late cancellation."
      />
      <ClassTimetable canBook={canBook} membershipStatus={profile?.status ?? 'PENDING'} />
    </>
  );
}

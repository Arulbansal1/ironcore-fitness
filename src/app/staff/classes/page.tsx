import { CalendarDays } from 'lucide-react';
import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/AppShell';
import { Card, CardBody, CardHeader, EmptyState } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { prisma } from '@/lib/prisma';
import { DAY_NAMES } from '@/lib/constants';

export const metadata: Metadata = { title: 'Timetable' };
export const dynamic = 'force-dynamic';

export default async function StaffTimetablePage() {
  const classes = await prisma.gymClass.findMany({
    where: { isActive: true },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    include: {
      trainer: { select: { name: true } },
      _count: { select: { bookings: true } },
    },
  });

  const byDay = classes.reduce<Record<number, typeof classes>>((acc, item) => {
    (acc[item.dayOfWeek] ??= []).push(item);
    return acc;
  }, {});
  const orderedDays = [1, 2, 3, 4, 5, 6, 0].filter((day) => byDay[day]?.length);

  return (
    <>
      <PageHeader
        title="Class timetable"
        description="The weekly schedule members book against, with trainer allocation and capacity."
      />

      {classes.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarDays className="h-5 w-5" />}
            title="No classes scheduled"
            description="Add classes to the timetable so members can book."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {orderedDays.map((day) => (
            <Card key={day}>
              <CardHeader title={DAY_NAMES[day]} icon={<CalendarDays className="h-4 w-4" />} />
              <CardBody className="space-y-2">
                {byDay[day].map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{item.name}</p>
                      <p className="text-xs text-muted">
                        {item.startTime} · {item.durationMins} min · {item.room}
                        {item.trainer ? ` · ${item.trainer.name}` : ' · no trainer assigned'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Badge tone="neutral">Capacity {item.capacity}</Badge>
                      <Badge tone="info">{item._count.bookings} bookings</Badge>
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

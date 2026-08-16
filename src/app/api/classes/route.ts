import { z } from 'zod';

import { recordAudit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { ApiError, ok, readJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** Next calendar date matching a weekday, from today onwards. */
function nextDateForWeekday(dayOfWeek: number, weeksAhead = 0): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  while (date.getDay() !== dayOfWeek) date.setDate(date.getDate() + 1);
  date.setDate(date.getDate() + weeksAhead * 7);
  return date;
}

/**
 * The weekly timetable with live capacity and the caller's own booking state.
 *
 * Capacity is counted per session date rather than per class, because a class is
 * a recurring template — "Spin is full" is only ever true of a specific session.
 */
export const GET = route(async (request: Request) => {
  const user = await requireUser();
  const weeksAhead = Math.min(Math.max(Number(new URL(request.url).searchParams.get('week')) || 0, 0), 3);

  const classes = await prisma.gymClass.findMany({
    where: { isActive: true },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    include: { trainer: { select: { id: true, name: true, avatarColor: true } } },
  });

  const sessions = classes.map((gymClass) => ({
    gymClass,
    sessionDate: nextDateForWeekday(gymClass.dayOfWeek, weeksAhead),
  }));

  const bookings = await prisma.classBooking.findMany({
    where: {
      classId: { in: classes.map((c) => c.id) },
      status: { in: ['BOOKED', 'WAITLISTED'] },
    },
    select: { classId: true, memberId: true, sessionDate: true, status: true, id: true },
  });

  const timetable = sessions.map(({ gymClass, sessionDate }) => {
    const forSession = bookings.filter(
      (b) => b.classId === gymClass.id && b.sessionDate.getTime() === sessionDate.getTime(),
    );
    const booked = forSession.filter((b) => b.status === 'BOOKED').length;
    const mine = forSession.find((b) => b.memberId === user.id);

    return {
      id: gymClass.id,
      name: gymClass.name,
      description: gymClass.description,
      dayOfWeek: gymClass.dayOfWeek,
      startTime: gymClass.startTime,
      durationMins: gymClass.durationMins,
      room: gymClass.room,
      intensity: gymClass.intensity,
      capacity: gymClass.capacity,
      booked,
      spacesLeft: Math.max(0, gymClass.capacity - booked),
      waitlistCount: forSession.filter((b) => b.status === 'WAITLISTED').length,
      trainer: gymClass.trainer,
      sessionDate: sessionDate.toISOString(),
      myBooking: mine ? { id: mine.id, status: mine.status } : null,
    };
  });

  return ok({ timetable, weeksAhead });
});

const bookSchema = z.object({
  classId: z.string().min(1),
  sessionDate: z.string().min(1),
});

/** Books a class, or joins the waitlist when the session is full. */
export const POST = route(async (request: Request) => {
  const user = await requireUser(['MEMBER']);
  const input = bookSchema.parse(await readJson(request));

  const gymClass = await prisma.gymClass.findUnique({ where: { id: input.classId } });
  if (!gymClass || !gymClass.isActive) throw ApiError.notFound('That class is not on the timetable.');

  const sessionDate = new Date(input.sessionDate);
  if (Number.isNaN(sessionDate.getTime())) throw ApiError.badRequest('Invalid session date.');
  if (sessionDate.getTime() < new Date().setHours(0, 0, 0, 0)) {
    throw ApiError.badRequest('That session has already happened.');
  }

  // A membership that is not active cannot hold a place.
  const profile = await prisma.memberProfile.findUnique({ where: { userId: user.id } });
  if (!profile) throw ApiError.badRequest('You need an active membership to book classes.');
  if (profile.status !== 'ACTIVE') {
    throw ApiError.badRequest(
      `Your membership is ${profile.status.toLowerCase()}, so class booking is unavailable. Open a ticket and the front desk will help.`,
    );
  }

  const existing = await prisma.classBooking.findFirst({
    where: { memberId: user.id, classId: input.classId, sessionDate },
  });
  if (existing && existing.status !== 'CANCELLED') {
    throw ApiError.conflict(
      existing.status === 'WAITLISTED'
        ? 'You are already on the waitlist for this session.'
        : 'You are already booked onto this session.',
    );
  }

  const booked = await prisma.classBooking.count({
    where: { classId: input.classId, sessionDate, status: 'BOOKED' },
  });
  const status = booked >= gymClass.capacity ? 'WAITLISTED' : 'BOOKED';

  const booking = existing
    ? await prisma.classBooking.update({
        where: { id: existing.id },
        data: { status, bookedAt: new Date(), cancelledAt: null },
      })
    : await prisma.classBooking.create({
        data: { memberId: user.id, classId: input.classId, sessionDate, status },
      });

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: status === 'BOOKED' ? 'class.booked' : 'class.waitlisted',
    entityType: 'ClassBooking',
    entityId: booking.id,
    detail: `${gymClass.name} on ${sessionDate.toDateString()}`,
    metadata: { classId: gymClass.id, status },
  });

  return ok(
    {
      message:
        status === 'BOOKED'
          ? `Booked onto ${gymClass.name}.`
          : `${gymClass.name} is full — you're on the waitlist and we'll notify you if a place frees up.`,
      booking,
    },
    201,
  );
});

const cancelSchema = z.object({ bookingId: z.string().min(1) });

/**
 * Cancels a booking and promotes the first waitlisted member into the free
 * place, so a cancellation actually gives someone else the spot.
 */
export const DELETE = route(async (request: Request) => {
  const user = await requireUser(['MEMBER']);
  const input = cancelSchema.parse(await readJson(request));

  const booking = await prisma.classBooking.findUnique({
    where: { id: input.bookingId },
    include: { gymClass: { select: { name: true, startTime: true } } },
  });
  if (!booking || booking.memberId !== user.id) {
    throw ApiError.notFound('That booking does not exist.');
  }
  if (booking.status === 'CANCELLED') {
    throw ApiError.conflict('That booking is already cancelled.');
  }

  const wasBooked = booking.status === 'BOOKED';

  await prisma.classBooking.update({
    where: { id: booking.id },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
  });

  let promoted: string | null = null;
  if (wasBooked) {
    const nextInLine = await prisma.classBooking.findFirst({
      where: {
        classId: booking.classId,
        sessionDate: booking.sessionDate,
        status: 'WAITLISTED',
      },
      orderBy: { bookedAt: 'asc' },
      include: { member: { select: { id: true, name: true } } },
    });

    if (nextInLine) {
      await prisma.classBooking.update({
        where: { id: nextInLine.id },
        data: { status: 'BOOKED' },
      });
      await prisma.notification.create({
        data: {
          userId: nextInLine.member.id,
          title: `A place opened up in ${booking.gymClass.name}`,
          body: `You were on the waitlist and you're now booked in at ${booking.gymClass.startTime}.`,
          link: '/member/classes',
          level: 'info',
        },
      });
      promoted = nextInLine.member.name;
    }
  }

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'class.cancelled',
    entityType: 'ClassBooking',
    entityId: booking.id,
    detail: `${booking.gymClass.name}${promoted ? ` — ${promoted} promoted from the waitlist` : ''}`,
  });

  return ok({
    message: promoted
      ? `Booking cancelled. ${promoted} has been moved off the waitlist into your place.`
      : 'Booking cancelled.',
    promoted,
  });
});

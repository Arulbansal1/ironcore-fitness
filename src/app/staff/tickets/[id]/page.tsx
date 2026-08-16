import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { slaSnapshot } from '@/lib/sla';

import { StaffTicketWorkspace } from './StaffTicketWorkspace';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: { number: true, subject: true },
  });
  return { title: ticket ? `#${ticket.number} — ${ticket.subject}` : 'Ticket' };
}

export default async function StaffTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSession();
  if (!user) redirect('/login');
  if (user.role !== 'STAFF' && user.role !== 'ADMIN') redirect('/member');

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      member: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarColor: true,
          phone: true,
          memberProfile: true,
          createdAt: true,
        },
      },
      assignee: { select: { id: true, name: true, email: true, avatarColor: true } },
      slaPolicy: { select: { name: true, firstResponseMins: true, resolutionMins: true } },
    },
  });
  if (!ticket) notFound();

  const [
    messages,
    events,
    attachments,
    suggestions,
    escalations,
    staff,
    visitsThisMonth,
    lastVisit,
    upcomingBookings,
    memberHistory,
  ] =
    await Promise.all([
      prisma.message.findMany({
        where: { ticketId: id },
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: { id: true, name: true, role: true, avatarColor: true } },
          attachments: { select: { id: true, filename: true, mimeType: true, sizeBytes: true } },
        },
      }),
      prisma.ticketEvent.findMany({
        where: { ticketId: id },
        orderBy: { createdAt: 'asc' },
        include: { actor: { select: { id: true, name: true, role: true } } },
      }),
      prisma.attachment.findMany({
        where: { ticketId: id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          filename: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true,
          uploader: { select: { name: true } },
        },
      }),
      prisma.aiSuggestion.findMany({
        where: { ticketId: id },
        orderBy: { createdAt: 'desc' },
        include: { reviewedBy: { select: { id: true, name: true } } },
      }),
      prisma.escalation.findMany({
        where: { ticketId: id },
        orderBy: { createdAt: 'desc' },
        include: { acknowledgedBy: { select: { id: true, name: true } } },
      }),
      prisma.user.findMany({
        where: { role: { in: ['STAFF', 'ADMIN'] }, isActive: true },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          avatarColor: true,
          staffProfile: { select: { specialties: true, isAvailable: true, maxOpenTickets: true } },
          _count: {
            select: {
              ticketsAsOwner: {
                where: { status: { in: ['OPEN', 'IN_PROGRESS', 'PENDING_MEMBER'] } },
              },
            },
          },
        },
      }),
      // Attendance and upcoming bookings power the member context panel.
      prisma.checkIn.count({
        where: {
          memberId: ticket.memberId,
          at: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
      prisma.checkIn.findFirst({
        where: { memberId: ticket.memberId },
        orderBy: { at: 'desc' },
        select: { at: true },
      }),
      prisma.classBooking.findMany({
        where: {
          memberId: ticket.memberId,
          sessionDate: { gte: new Date() },
          status: { in: ['BOOKED', 'WAITLISTED'] },
        },
        orderBy: { sessionDate: 'asc' },
        take: 3,
        include: {
          gymClass: {
            select: { name: true, startTime: true, room: true, trainer: { select: { name: true } } },
          },
        },
      }),

      // Prior tickets from the same member give the staff instant context.
      prisma.ticket.findMany({
        where: { memberId: ticket.memberId, id: { not: id } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          number: true,
          subject: true,
          status: true,
          priority: true,
          satisfaction: true,
          createdAt: true,
        },
      }),
    ]);

  return (
    <>
      <Link
        href="/staff/tickets"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to queue
      </Link>

      <StaffTicketWorkspace
        currentUserId={user.id}
        currentUserRole={user.role}
        ticket={{
          id: ticket.id,
          number: ticket.number,
          subject: ticket.subject,
          body: ticket.body,
          status: ticket.status,
          priority: ticket.priority,
          category: ticket.category,
          aiSummary: ticket.aiSummary,
          aiSentiment: ticket.aiSentiment,
          aiConfidence: ticket.aiConfidence,
          aiTags: ticket.aiTags,
          aiEngine: ticket.aiEngine,
          autoAssigned: ticket.autoAssigned,
          safetyFlag: ticket.safetyFlag,
          reopenCount: ticket.reopenCount,
          satisfaction: ticket.satisfaction,
          createdAt: ticket.createdAt.toISOString(),
          updatedAt: ticket.updatedAt.toISOString(),
          member: {
            id: ticket.member.id,
            name: ticket.member.name,
            email: ticket.member.email,
            phone: ticket.member.phone,
            avatarColor: ticket.member.avatarColor,
            createdAt: ticket.member.createdAt.toISOString(),
            profile: ticket.member.memberProfile
              ? {
                  memberNumber: ticket.member.memberProfile.memberNumber,
                  tier: ticket.member.memberProfile.tier,
                  status: ticket.member.memberProfile.status,
                  joinedAt: ticket.member.memberProfile.joinedAt.toISOString(),
                  expiresAt: ticket.member.memberProfile.expiresAt?.toISOString() ?? null,
                  frozenUntil: ticket.member.memberProfile.frozenUntil?.toISOString() ?? null,
                  freezeReason: ticket.member.memberProfile.freezeReason,
                  homeBranch: ticket.member.memberProfile.homeBranch,
                  goals: ticket.member.memberProfile.goals,
                  emergencyContactName: ticket.member.memberProfile.emergencyContactName,
                  emergencyContactPhone: ticket.member.memberProfile.emergencyContactPhone,
                  medicalNotes: ticket.member.memberProfile.medicalNotes,
                }
              : null,
            visitsThisMonth,
            lastVisitAt: lastVisit?.at.toISOString() ?? null,
            upcomingBookings: upcomingBookings.map((booking) => ({
              id: booking.id,
              className: booking.gymClass.name,
              trainerName: booking.gymClass.trainer?.name ?? null,
              sessionDate: booking.sessionDate.toISOString(),
              startTime: booking.gymClass.startTime,
              room: booking.gymClass.room,
              status: booking.status,
            })),
          },
          assignee: ticket.assignee,
          slaPolicyName: ticket.slaPolicy?.name ?? null,
          sla: slaSnapshot(ticket),
        }}
        messages={messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
        events={events.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() }))}
        attachments={attachments.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }))}
        suggestions={suggestions.map((s) => ({
          ...s,
          createdAt: s.createdAt.toISOString(),
          reviewedAt: s.reviewedAt?.toISOString() ?? null,
        }))}
        escalations={escalations.map((e) => ({
          ...e,
          createdAt: e.createdAt.toISOString(),
          acknowledgedAt: e.acknowledgedAt?.toISOString() ?? null,
          resolvedAt: e.resolvedAt?.toISOString() ?? null,
        }))}
        staff={staff.map((a) => ({
          id: a.id,
          name: a.name,
          avatarColor: a.avatarColor,
          specialties: a.staffProfile?.specialties ?? [],
          isAvailable: a.staffProfile?.isAvailable ?? true,
          openTickets: a._count.ticketsAsOwner,
          maxOpenTickets: a.staffProfile?.maxOpenTickets ?? null,
        }))}
        memberHistory={memberHistory.map((t) => ({
          ...t,
          createdAt: t.createdAt.toISOString(),
        }))}
      />
    </>
  );
}

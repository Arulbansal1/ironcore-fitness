import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { slaSnapshot } from '@/lib/sla';

import { MemberTicketView } from './MemberTicketView';

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

export default async function MemberTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSession();
  if (!user) redirect('/login');

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
        },
      },
      assignee: { select: { id: true, name: true, email: true, avatarColor: true } },
      slaPolicy: { select: { name: true, firstResponseMins: true, resolutionMins: true } },
    },
  });

  // A member must never learn that another member's ticket exists.
  if (!ticket || (user.role === 'MEMBER' && ticket.memberId !== user.id)) notFound();

  const [messages, events, attachments] = await Promise.all([
    prisma.message.findMany({
      where: { ticketId: id, isInternal: false },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { id: true, name: true, role: true, avatarColor: true } },
        attachments: { select: { id: true, filename: true, mimeType: true, sizeBytes: true } },
      },
    }),
    prisma.ticketEvent.findMany({
      where: {
        ticketId: id,
        // Internal routing chatter is not shown to the member.
        type: { notIn: ['ai_suggested', 'ai_reviewed'] },
      },
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
  ]);

  return (
    <>
      <Link
        href="/member/tickets"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to my tickets
      </Link>

      <MemberTicketView
        currentUserId={user.id}
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
          satisfaction: ticket.satisfaction,
          createdAt: ticket.createdAt.toISOString(),
          updatedAt: ticket.updatedAt.toISOString(),
          assignee: ticket.assignee,
          slaPolicyName: ticket.slaPolicy?.name ?? null,
          sla: slaSnapshot(ticket),
        }}
        messages={messages.map((message) => ({
          ...message,
          createdAt: message.createdAt.toISOString(),
        }))}
        events={events.map((event) => ({
          ...event,
          createdAt: event.createdAt.toISOString(),
        }))}
        attachments={attachments.map((attachment) => ({
          ...attachment,
          createdAt: attachment.createdAt.toISOString(),
        }))}
      />
    </>
  );
}

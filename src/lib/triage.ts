import 'server-only';

import type { Prisma, Ticket, TicketCategory } from '@prisma/client';

import { activeEngine, activeModelName, draftReply, retrievalConfidence, triageTicket } from './ai';
import { notify, notifyMany, recordAudit, recordTicketEvent } from './audit';
import { prisma } from './prisma';
import { searchKnowledgeBase } from './rag';
import { applySla } from './sla';
import { sendSlackAlert } from './slack';

/**
 * Full automatic triage pipeline for a newly created ticket:
 *   classify → set priority/sentiment/summary → apply SLA → auto-assign →
 *   retrieve knowledge base context → draft a reply suggestion for the staff.
 *
 * Every step is best-effort: a failure is logged and the ticket stays usable.
 */
export async function runTriagePipeline(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { member: { select: { id: true, name: true } } },
  });
  if (!ticket) throw new Error(`Ticket ${ticketId} not found`);

  const started = Date.now();

  // 1 — classification -------------------------------------------------------
  const triage = await triageTicket({ subject: ticket.subject, body: ticket.body });

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      category: triage.category,
      priority: triage.priority,
      aiSummary: triage.summary,
      aiSentiment: triage.sentiment,
      aiConfidence: triage.confidence,
      aiTags: triage.tags,
      aiEngine: triage.engine,
      aiTriagedAt: new Date(),
      safetyFlag: triage.safetyFlag,
    },
  });

  await recordTicketEvent({
    ticketId,
    type: 'ai_triaged',
    summary: `AI triage: ${triage.category.replace(/_/g, ' ').toLowerCase()} · ${triage.priority.toLowerCase()} priority · ${triage.sentiment.toLowerCase()} sentiment (${Math.round(
      triage.confidence * 100,
    )}% confidence)`,
    toValue: `${triage.category}/${triage.priority}`,
  });

  await recordAudit({
    action: 'ticket.ai_triaged',
    entityType: 'Ticket',
    entityId: ticketId,
    detail: triage.reasoning,
    metadata: {
      category: triage.category,
      priority: triage.priority,
      sentiment: triage.sentiment,
      confidence: triage.confidence,
      engine: triage.engine,
      model: triage.model,
    },
  });

  // 1b — safety escalation ---------------------------------------------------
  // A member reporting an injury or hazard is escalated the moment the ticket is
  // created, rather than waiting for an SLA timer to expire.
  if (triage.safetyFlag) {
    await raiseSafetyEscalation(ticketId, ticket.number, ticket.subject, triage.summary);
  }

  // 2 — SLA ------------------------------------------------------------------
  await applySla(ticketId, triage.priority, ticket.createdAt);

  // 3 — auto-assignment ------------------------------------------------------
  const assignee = await pickBestAgent(triage.category);
  if (assignee) {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { assigneeId: assignee.id, autoAssigned: true, status: 'IN_PROGRESS' },
    });
    await recordTicketEvent({
      ticketId,
      type: 'assigned',
      summary: `Auto-assigned to ${assignee.name} (${assignee.reason})`,
      toValue: assignee.name,
    });
    await notify({
      userId: assignee.id,
      title: `New ${triage.priority.toLowerCase()} ticket #${ticket.number}`,
      body: `${ticket.subject} — auto-assigned to you by AI triage.`,
      link: `/staff/tickets/${ticketId}`,
      level: triage.priority === 'URGENT' ? 'critical' : 'info',
    });
  }

  // 4 — automatic acknowledgement -------------------------------------------
  // Sent to the member straight away so nobody is left staring at silence.
  // Deliberately does NOT set `firstRespondedAt`: the first-response SLA measures
  // a real human answer, and letting an automated message satisfy it would make
  // every SLA figure meaningless.
  await sendAcknowledgement(ticketId, {
    memberName: ticket.member.name,
    category: triage.category,
    priority: triage.priority,
    sentiment: triage.sentiment,
    safetyFlag: triage.safetyFlag,
    assigneeName: assignee?.name ?? null,
  }).catch((error) => console.error('[triage] acknowledgement failed', error));

  // 5 — RAG reply suggestion -------------------------------------------------
  const suggestion = await generateSuggestion(ticketId).catch((error) => {
    console.error('[triage] suggestion generation failed', error);
    return null;
  });

  return {
    triage,
    assignee,
    suggestionId: suggestion?.id ?? null,
    elapsedMs: Date.now() - started,
  };
}

// ---------------------------------------------------------------------------
// Auto-assignment
// ---------------------------------------------------------------------------

export type AssignmentChoice = { id: string; name: string; reason: string };

/**
 * Picks the best available staff using: specialty match → spare capacity →
 * fewest open tickets. Returns null when no staff has capacity.
 */
export async function pickBestAgent(category: TicketCategory): Promise<AssignmentChoice | null> {
  const staff = await prisma.user.findMany({
    where: { role: 'STAFF', isActive: true, staffProfile: { isAvailable: true } },
    include: {
      staffProfile: true,
      _count: {
        select: {
          ticketsAsOwner: {
            where: { status: { in: ['OPEN', 'IN_PROGRESS', 'PENDING_MEMBER'] } },
          },
        },
      },
    },
  });

  if (staff.length === 0) return null;

  const scored = staff
    .map((staff) => {
      const openCount = staff._count.ticketsAsOwner;
      const capacity = staff.staffProfile?.maxOpenTickets ?? 15;
      const specialties = staff.staffProfile?.specialties ?? [];
      const specialtyMatch = specialties.includes(category);
      const load = openCount / Math.max(capacity, 1);

      return {
        staff,
        openCount,
        capacity,
        specialtyMatch,
        hasCapacity: openCount < capacity,
        // Higher is better.
        score: (specialtyMatch ? 100 : 0) + (1 - Math.min(load, 1)) * 50,
      };
    })
    .sort((a, b) => b.score - a.score || a.openCount - b.openCount);

  const withCapacity = scored.filter((s) => s.hasCapacity);
  const chosen = withCapacity[0] ?? scored[0];
  if (!chosen) return null;

  const reason = chosen.specialtyMatch
    ? `specialises in ${category.replace(/_/g, ' ').toLowerCase()}, ${chosen.openCount}/${chosen.capacity} open`
    : `lowest load, ${chosen.openCount}/${chosen.capacity} open`;

  return { id: chosen.staff.id, name: chosen.staff.name, reason };
}

// ---------------------------------------------------------------------------
// Reply suggestion (RAG)
// ---------------------------------------------------------------------------

export type Citation = {
  articleId: string;
  title: string;
  slug: string;
  similarity: number;
  used: boolean;
};

/**
 * Retrieves knowledge base context for a ticket and stores a reviewable
 * AI reply suggestion. Returns the created AiSuggestion row.
 */
export async function generateSuggestion(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      member: { select: { name: true } },
      messages: {
        where: { isInternal: false },
        orderBy: { createdAt: 'asc' },
        take: 20,
        select: { body: true, authorType: true },
      },
    },
  });
  if (!ticket) throw new Error(`Ticket ${ticketId} not found`);

  const started = Date.now();
  const query = `${ticket.subject}\n${ticket.body}`;
  const context = await searchKnowledgeBase(query, { limit: 4 });

  const history = ticket.messages.map((m) => ({
    role: m.authorType === 'MEMBER' ? ('member' as const) : ('staff' as const),
    text: m.body,
  }));

  const draft = await draftReply({
    customerName: ticket.member.name,
    subject: ticket.subject,
    body: ticket.body,
    history,
    context,
  });

  const usedIds = new Set(draft.usedArticleIds);
  const citations: Citation[] = context.map((c) => ({
    articleId: c.articleId,
    title: c.title,
    slug: c.slug,
    similarity: c.similarity,
    used: usedIds.size > 0 ? usedIds.has(c.articleId) : c === context[0],
  }));

  // Blend model self-assessment with retrieval quality so a confident-sounding
  // answer with no supporting article cannot report high confidence.
  const blended = Number(
    Math.max(0.05, Math.min(0.99, draft.confidence * 0.6 + retrievalConfidence(context) * 0.4)).toFixed(2),
  );

  const suggestion = await prisma.aiSuggestion.create({
    data: {
      ticketId,
      draft: draft.draft,
      confidence: blended,
      engine: draft.engine,
      model: draft.model,
      citations: citations as unknown as Prisma.InputJsonValue,
      latencyMs: Date.now() - started,
    },
  });

  await recordTicketEvent({
    ticketId,
    type: 'ai_suggested',
    summary: `AI drafted a reply with ${Math.round(blended * 100)}% confidence from ${citations.length} knowledge base source(s)`,
  });

  return suggestion;
}

/** Sentiment-driven escalation check, run when a member posts a message. */
export async function checkSentimentEscalation(ticket: Ticket, messageBody: string) {
  const negative = /\b(furious|angry|unacceptable|ridiculous|cancel(?:ling)? my|refund now|lawyer|terrible|worst|fed up)\b/i;
  if (!negative.test(messageBody)) return null;

  const existing = await prisma.escalation.findFirst({
    where: { ticketId: ticket.id, reason: 'NEGATIVE_SENTIMENT', status: { not: 'RESOLVED' } },
  });
  if (existing) return null;

  return prisma.escalation.create({
    data: {
      ticketId: ticket.id,
      reason: 'NEGATIVE_SENTIMENT',
      level: 1,
      detail: 'Member message contains strong negative sentiment. Recommend a senior staff review.',
    },
  });
}

export function engineLabel() {
  return { engine: activeEngine(), model: activeModelName() };
}

/**
 * Raises an immediate escalation when triage detects an injury, medical event or
 * safety hazard, and pushes it straight to Slack.
 *
 * This deliberately does not wait for an SLA timer. A member writing "I hurt my
 * shoulder on the cable machine" is the one message a gym support desk cannot
 * afford to leave sitting in a queue, so it alerts on arrival.
 */
export async function raiseSafetyEscalation(
  ticketId: string,
  ticketNumber: number,
  subject: string,
  summary: string,
) {
  const existing = await prisma.escalation.findFirst({
    where: { ticketId, reason: 'SAFETY_RISK' },
  });
  if (existing) return existing;

  const detail = `Safety signal detected by AI triage on arrival: ${summary}`;

  const escalation = await prisma.escalation.create({
    data: { ticketId, reason: 'SAFETY_RISK', level: 2, detail, status: 'OPEN' },
  });

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      member: { select: { name: true, email: true, memberProfile: { select: { medicalNotes: true } } } },
      assignee: { select: { id: true, name: true } },
    },
  });

  const alert = await sendSlackAlert({
    title: 'Member safety report — immediate review',
    severity: 'critical',
    ticketId,
    ticketNumber,
    ticketSubject: subject,
    detail,
    fields: [
      { label: 'Member', value: ticket ? `${ticket.member.name} (${ticket.member.email})` : 'unknown' },
      { label: 'Assigned to', value: ticket?.assignee?.name ?? '_unassigned_' },
      {
        label: 'Medical notes on file',
        value: ticket?.member.memberProfile?.medicalNotes ? 'Yes — check the member record' : 'None recorded',
      },
      { label: 'Raised', value: 'Automatically, on ticket creation' },
    ],
  });

  await prisma.escalation.update({
    where: { id: escalation.id },
    data: { slackNotified: alert.sent, slackError: alert.error ?? null },
  });

  await recordTicketEvent({
    ticketId,
    type: 'escalated',
    summary: 'Safety signal detected by AI triage — escalated immediately for review',
    toValue: 'SAFETY_RISK',
  });

  await recordAudit({
    action: 'safety.auto_escalated',
    entityType: 'Ticket',
    entityId: ticketId,
    detail,
    metadata: { ticketNumber, slackSent: alert.sent },
  });

  const managers = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true },
  });
  await notifyMany(
    [...managers.map((m) => m.id), ...(ticket?.assignee ? [ticket.assignee.id] : [])],
    {
      title: `Safety report on #${ticketNumber}`,
      body: subject,
      link: `/staff/tickets/${ticketId}`,
      level: 'critical',
    },
  );

  return escalation;
}


// ---------------------------------------------------------------------------
// Automatic acknowledgement
// ---------------------------------------------------------------------------

const CATEGORY_PHRASE: Record<TicketCategory, string> = {
  MEMBERSHIP: 'your membership',
  EQUIPMENT: 'the equipment issue you reported',
  CLASSES: 'your class booking',
  PERSONAL_TRAINING: 'your personal training',
  NUTRITION: 'your nutrition question',
  INJURY: 'what happened to you',
  ACCOUNT: 'your account access',
  COMPLAINT: 'your complaint',
  GENERAL: 'your message',
};

/** Human-readable form of an SLA target in minutes. */
function targetPhrase(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return `${days} working day${days === 1 ? '' : 's'}`;
}

/**
 * Posts an immediate, honest acknowledgement to the member.
 *
 * It is explicitly labelled automatic and never claims the problem is solved or
 * that a person has read it yet — it confirms receipt, says what happens next,
 * and gives the response target so the member knows what to expect. Pretending
 * a bot reply was a staff member would be worse than silence.
 */
export async function sendAcknowledgement(
  ticketId: string,
  context: {
    memberName: string;
    category: TicketCategory;
    priority: string;
    sentiment: string;
    safetyFlag: boolean;
    assigneeName: string | null;
  },
) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { number: true, firstResponseDue: true, createdAt: true, slaPolicy: true },
  });
  if (!ticket) return null;

  // Don't double-acknowledge if the pipeline is re-run.
  const existing = await prisma.message.findFirst({
    where: { ticketId, authorType: 'SYSTEM' },
    select: { id: true },
  });
  if (existing) return existing;

  const firstName = context.memberName.split(' ')[0] || 'there';
  const targetMins =
    ticket.slaPolicy?.firstResponseMins ??
    (ticket.firstResponseDue
      ? Math.round((ticket.firstResponseDue.getTime() - ticket.createdAt.getTime()) / 60_000)
      : 240);

  const upset =
    context.sentiment === 'FRUSTRATED' || context.sentiment === 'NEGATIVE' || context.safetyFlag;

  // --- opening: apologise only where there is something to apologise for ---
  let opening: string;
  if (context.safetyFlag) {
    opening = `Hi ${firstName}, thank you for telling us — we're sorry this happened and we're treating it as urgent.`;
  } else if (upset) {
    opening = `Hi ${firstName}, thanks for getting in touch, and sorry for the trouble with ${CATEGORY_PHRASE[context.category]}.`;
  } else {
    opening = `Hi ${firstName}, thanks for getting in touch about ${CATEGORY_PHRASE[context.category]}.`;
  }

  // --- middle: what is actually happening now ---
  const routed = context.assigneeName
    ? `It's been logged as ticket #${ticket.number} and passed to ${context.assigneeName}, who handles this kind of thing.`
    : `It's been logged as ticket #${ticket.number} and is in the queue for the next available member of the team.`;

  const commitment = context.safetyFlag
    ? `Our duty manager has already been alerted and will review it immediately. If you are hurt or you feel unwell, please speak to a member of staff at the front desk straight away, or call emergency services — please don't wait for this reply.`
    : `We aim to respond properly within ${targetPhrase(targetMins)}, and often sooner.`;

  const closing =
    `You'll get an email as soon as someone replies, and you can add anything else to this ticket at any time.\n\n— the IronCore Fitness team`;

  const body = `${opening}\n\n${routed} ${commitment}\n\n${closing}`;

  const message = await prisma.message.create({
    data: {
      ticketId,
      authorId: null,
      authorType: 'SYSTEM',
      body,
      isInternal: false,
    },
  });

  await recordTicketEvent({
    ticketId,
    type: 'acknowledged',
    summary: 'Automatic acknowledgement sent to the member',
  });

  return message;
}

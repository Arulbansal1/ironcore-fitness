import { recordAudit, recordTicketEvent } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { ApiError, clientIp, ok, readJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { suggestionReviewSchema } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

/**
 * Human review of an AI reply draft.
 *
 *   approve — accept the draft verbatim, ready to send
 *   edit    — accept with the staff's edits (the edited text is what counts)
 *   reject  — discard it and explain nothing to the member
 *
 * Reviewing never sends anything: the staff still posts the message. This keeps
 * a human explicitly in the loop for every member-facing reply.
 */
export const PATCH = route(async (request: Request, context: Params) => {
  const { id } = await context.params;
  const user = await requireUser(['STAFF', 'ADMIN']);
  const input = suggestionReviewSchema.parse(await readJson(request));

  const suggestion = await prisma.aiSuggestion.findUnique({
    where: { id },
    include: { ticket: { select: { id: true, number: true } } },
  });
  if (!suggestion) throw ApiError.notFound('That AI draft no longer exists.');

  if (suggestion.status !== 'PENDING') {
    throw ApiError.conflict(
      `This draft was already ${suggestion.status.toLowerCase()} and cannot be reviewed again.`,
    );
  }

  if (input.action === 'edit' && !input.finalText?.trim()) {
    throw ApiError.badRequest('Provide the edited reply text.');
  }

  const status = input.action === 'approve' ? 'APPROVED' : input.action === 'edit' ? 'EDITED' : 'REJECTED';
  const finalText =
    input.action === 'approve'
      ? suggestion.draft
      : input.action === 'edit'
        ? input.finalText!.trim()
        : null;

  const updated = await prisma.aiSuggestion.update({
    where: { id },
    data: { status, finalText, reviewedById: user.id, reviewedAt: new Date() },
    include: { reviewedBy: { select: { id: true, name: true } } },
  });

  const verb =
    input.action === 'approve' ? 'approved' : input.action === 'edit' ? 'edited and approved' : 'rejected';

  await recordTicketEvent({
    ticketId: suggestion.ticketId,
    actorId: user.id,
    type: 'ai_reviewed',
    summary: `${user.name} ${verb} the AI draft (${Math.round(suggestion.confidence * 100)}% confidence)`,
    toValue: status,
  });

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: `ai.draft_${input.action}`,
    entityType: 'AiSuggestion',
    entityId: id,
    detail: `Ticket #${suggestion.ticket.number}: AI draft ${verb}.`,
    metadata: {
      ticketId: suggestion.ticketId,
      confidence: suggestion.confidence,
      engine: suggestion.engine,
      model: suggestion.model,
      edited: input.action === 'edit',
    },
    ip: clientIp(request),
  });

  return ok({
    message:
      input.action === 'reject'
        ? 'Draft rejected.'
        : 'Draft approved — it has been loaded into the reply box for you to send.',
    suggestion: updated,
  });
});

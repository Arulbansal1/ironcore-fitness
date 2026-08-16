import { requireUser } from '@/lib/auth';
import { ApiError, ok, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { getTicketForUser } from '@/lib/tickets';
import { generateSuggestion } from '@/lib/triage';

type Params = { params: Promise<{ id: string }> };

/**
 * Regenerates an AI reply draft for a ticket using the current conversation and
 * the latest Knowledge Base content. Agents and admins only — a member must
 * never be able to trigger model spend or see an unreviewed draft.
 */
export const POST = route(async (request: Request, context: Params) => {
  const { id } = await context.params;
  const user = await requireUser(['STAFF', 'ADMIN']);
  const ticket = await getTicketForUser(id, user);

  if (ticket.status === 'CLOSED') {
    throw ApiError.badRequest('This ticket is closed. Reopen it before drafting a new reply.');
  }

  // Cheap guard against a stuck button flooding the model with requests.
  const recent = await prisma.aiSuggestion.count({
    where: { ticketId: id, createdAt: { gte: new Date(Date.now() - 10_000) } },
  });
  if (recent >= 2) {
    throw ApiError.tooMany('A draft was just generated. Give it a moment before requesting another.');
  }

  const suggestion = await generateSuggestion(id);

  return ok(
    {
      message: 'New draft generated.',
      suggestion: await prisma.aiSuggestion.findUnique({
        where: { id: suggestion.id },
        include: { reviewedBy: { select: { id: true, name: true } } },
      }),
    },
    201,
  );
});

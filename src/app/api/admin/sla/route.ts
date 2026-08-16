import { recordAudit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { ApiError, clientIp, ok, readJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { slaPolicySchema, ticketPriorityEnum } from '@/lib/validation';

export const GET = route(async () => {
  await requireUser(['STAFF', 'ADMIN']);

  const policies = await prisma.slaPolicy.findMany({
    orderBy: { priority: 'desc' },
    include: { _count: { select: { tickets: true } } },
  });

  return ok({ policies });
});

const upsertSchema = slaPolicySchema.extend({ priority: ticketPriorityEnum });

/**
 * Creates or updates the policy for a priority.
 * One policy per priority (enforced by a unique constraint), so this upserts
 * rather than making an admin hunt for the existing row.
 */
export const PUT = route(async (request: Request) => {
  const user = await requireUser(['ADMIN']);
  const input = upsertSchema.parse(await readJson(request));

  if (input.resolutionMins <= input.firstResponseMins) {
    throw ApiError.badRequest(
      'The resolution target must be longer than the first-response target.',
    );
  }

  const existing = await prisma.slaPolicy.findUnique({ where: { priority: input.priority } });

  const policy = await prisma.slaPolicy.upsert({
    where: { priority: input.priority },
    update: {
      name: input.name,
      firstResponseMins: input.firstResponseMins,
      resolutionMins: input.resolutionMins,
      escalateAfterMins: input.escalateAfterMins,
      notifySlack: input.notifySlack,
      isActive: input.isActive,
    },
    create: {
      priority: input.priority,
      name: input.name,
      firstResponseMins: input.firstResponseMins,
      resolutionMins: input.resolutionMins,
      escalateAfterMins: input.escalateAfterMins,
      notifySlack: input.notifySlack,
      isActive: input.isActive,
    },
  });

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: existing ? 'admin.sla_updated' : 'admin.sla_created',
    entityType: 'SlaPolicy',
    entityId: policy.id,
    detail: `${input.priority}: first response ${input.firstResponseMins}m, resolution ${input.resolutionMins}m${
      input.isActive ? '' : ' (inactive)'
    }`,
    metadata: {
      priority: input.priority,
      previous: existing
        ? { firstResponseMins: existing.firstResponseMins, resolutionMins: existing.resolutionMins }
        : null,
    },
    ip: clientIp(request),
  });

  return ok({
    message: `${input.priority.toLowerCase()} SLA policy saved. New tickets use it immediately; existing tickets keep their current deadlines until their priority changes.`,
    policy,
  });
});

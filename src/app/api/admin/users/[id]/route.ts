import { recordAudit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { ApiError, clientIp, ok, readJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { staffProfileSchema, updateUserSchema } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

const patchSchema = updateUserSchema.extend({
  staffProfile: staffProfileSchema.optional(),
});

/**
 * Updates a user's role, active state and staff profile.
 *
 * Two safety rules are enforced here rather than in the UI, because the UI can
 * be bypassed: an admin can never deactivate or demote themselves, and the
 * system must always retain at least one active admin.
 */
export const PATCH = route(async (request: Request, context: Params) => {
  const { id } = await context.params;
  const actor = await requireUser(['ADMIN']);
  const input = patchSchema.parse(await readJson(request));

  const target = await prisma.user.findUnique({
    where: { id },
    include: { staffProfile: true },
  });
  if (!target) throw ApiError.notFound('That user does not exist.');

  if (target.id === actor.id) {
    if (input.role && input.role !== 'ADMIN') {
      throw ApiError.badRequest('You cannot change your own role. Ask another administrator.');
    }
    if (input.isActive === false) {
      throw ApiError.badRequest('You cannot deactivate your own account.');
    }
  }

  const losingAdmin =
    target.role === 'ADMIN' && ((input.role && input.role !== 'ADMIN') || input.isActive === false);

  if (losingAdmin) {
    const remainingAdmins = await prisma.user.count({
      where: { role: 'ADMIN', isActive: true, id: { not: target.id } },
    });
    if (remainingAdmins === 0) {
      throw ApiError.badRequest(
        'This is the last active administrator. Promote another user to admin first.',
      );
    }
  }

  const changes: string[] = [];
  if (input.role && input.role !== target.role) changes.push(`role ${target.role} → ${input.role}`);
  if (input.isActive !== undefined && input.isActive !== target.isActive) {
    changes.push(input.isActive ? 'reactivated' : 'deactivated');
  }
  if (input.name && input.name !== target.name) changes.push(`name → ${input.name}`);

  const user = await prisma.user.update({
    where: { id },
    data: {
      role: input.role ?? undefined,
      isActive: input.isActive ?? undefined,
      name: input.name ?? undefined,
    },
  });

  // Promoting someone to AGENT gives them a profile so they can be auto-assigned.
  const shouldHaveProfile = user.role === 'STAFF';
  if (shouldHaveProfile && !target.staffProfile) {
    await prisma.staffProfile.create({
      data: {
        userId: user.id,
        title: input.staffProfile?.title ?? 'Support Staff',
        specialties: input.staffProfile?.specialties ?? [],
        maxOpenTickets: input.staffProfile?.maxOpenTickets ?? 15,
        isAvailable: input.staffProfile?.isAvailable ?? true,
      },
    });
    changes.push('staff profile created');
  } else if (input.staffProfile && target.staffProfile) {
    await prisma.staffProfile.update({
      where: { userId: user.id },
      data: {
        title: input.staffProfile.title ?? undefined,
        specialties: input.staffProfile.specialties ?? undefined,
        maxOpenTickets: input.staffProfile.maxOpenTickets ?? undefined,
        isAvailable: input.staffProfile.isAvailable ?? undefined,
      },
    });
    changes.push('staff profile updated');
  }

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: 'admin.user_updated',
    entityType: 'User',
    entityId: id,
    detail: `${target.email}: ${changes.join(', ') || 'no visible change'}`,
    metadata: { changes },
    ip: clientIp(request),
  });

  const updated = await prisma.user.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      emailVerified: true,
      avatarColor: true,
      staffProfile: {
        select: { title: true, specialties: true, maxOpenTickets: true, isAvailable: true },
      },
    },
  });

  return ok({ message: 'User updated.', user: updated });
});

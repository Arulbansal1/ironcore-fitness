import { recordAudit } from '@/lib/audit';
import { hashPassword, verifyOtpHash, verifyPassword } from '@/lib/auth';
import { ApiError, clientIp, ok, readJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { resetPasswordSchema } from '@/lib/validation';

const MAX_ATTEMPTS = 5;

export const POST = route(async (request: Request) => {
  const input = resetPasswordSchema.parse(await readJson(request));

  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw ApiError.badRequest('That reset code is not valid for this email address.');

  const otp = await prisma.otpCode.findFirst({
    where: { userId: user.id, purpose: 'PASSWORD_RESET', consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!otp) throw ApiError.badRequest('No active reset code found. Request a new one.');
  if (otp.expiresAt < new Date()) throw ApiError.badRequest('That reset code has expired. Request a new one.');
  if (otp.attempts >= MAX_ATTEMPTS) {
    throw ApiError.tooMany('Too many incorrect attempts. Request a new reset code.');
  }

  const matches = await verifyOtpHash(input.code, otp.codeHash);
  if (!matches) {
    const attempts = otp.attempts + 1;
    await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts } });
    const remaining = MAX_ATTEMPTS - attempts;
    throw ApiError.badRequest(
      remaining > 0
        ? `That code is incorrect. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
        : 'That code is incorrect and you have no attempts left. Request a new code.',
    );
  }

  const sameAsOld = await verifyPassword(input.password, user.passwordHash);
  if (sameAsOld) {
    throw ApiError.badRequest('Your new password must be different from your current one.');
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(input.password),
        // A successful reset proves mailbox ownership.
        emailVerified: true,
      },
    }),
    prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } }),
    // Invalidate every other outstanding code for this user.
    prisma.otpCode.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
  ]);

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'auth.password_reset',
    entityType: 'User',
    entityId: user.id,
    detail: 'Password reset using an emailed 6-digit code.',
    ip: clientIp(request),
  });

  return ok({
    message: 'Your password has been reset. You can sign in now.',
    redirectTo: '/login',
  });
});

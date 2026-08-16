import { recordAudit } from '@/lib/audit';
import { createSessionToken, homeForRole, setSessionCookie, verifyOtpHash } from '@/lib/auth';
import { ApiError, clientIp, ok, readJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { verifyOtpSchema } from '@/lib/validation';

const MAX_ATTEMPTS = 5;

export const POST = route(async (request: Request) => {
  const input = verifyOtpSchema.parse(await readJson(request));

  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw ApiError.badRequest('That code is not valid for this email address.');

  if (user.emailVerified) {
    return ok({
      message: 'This email is already verified. You can sign in.',
      alreadyVerified: true,
      redirectTo: '/login',
    });
  }

  const otp = await prisma.otpCode.findFirst({
    where: { userId: user.id, purpose: 'EMAIL_VERIFICATION', consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!otp) {
    throw ApiError.badRequest('No active code found. Request a new one and try again.');
  }
  if (otp.expiresAt < new Date()) {
    throw ApiError.badRequest('That code has expired. Request a new one.');
  }
  if (otp.attempts >= MAX_ATTEMPTS) {
    throw ApiError.tooMany('Too many incorrect attempts. Request a new code to continue.');
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

  const [verified] = await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, lastLoginAt: new Date() },
    }),
    prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } }),
  ]);

  // Verifying signs the member straight in — no second login step.
  const token = await createSessionToken(verified);
  await setSessionCookie(token);

  await prisma.notification.create({
    data: {
      userId: verified.id,
      title: 'Welcome to Support Desk',
      body: 'Your email is verified. Create your first ticket and our AI will triage it instantly.',
      link: '/member/tickets/new',
    },
  });

  await recordAudit({
    actorId: verified.id,
    actorEmail: verified.email,
    action: 'auth.email_verified',
    entityType: 'User',
    entityId: verified.id,
    detail: 'Email verified with 6-digit OTP.',
    ip: clientIp(request),
  });

  return ok({
    message: 'Email verified. Welcome aboard.',
    user: { id: verified.id, name: verified.name, email: verified.email, role: verified.role },
    redirectTo: homeForRole(verified.role),
  });
});

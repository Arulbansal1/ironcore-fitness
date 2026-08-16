import { recordAudit } from '@/lib/audit';
import {
  createSessionToken,
  generateOtp,
  hashOtp,
  homeForRole,
  setSessionCookie,
  verifyPassword,
} from '@/lib/auth';
import { sendEmail, verificationEmail } from '@/lib/email';
import { env } from '@/lib/env';
import { ApiError, clientIp, ok, readJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { loginSchema } from '@/lib/validation';

export const POST = route(async (request: Request) => {
  const input = loginSchema.parse(await readJson(request));
  const ip = clientIp(request);

  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // Same message for unknown email and wrong password — no account enumeration.
  const invalid = ApiError.unauthorized('Email or password is incorrect.');
  if (!user) throw invalid;

  const matches = await verifyPassword(input.password, user.passwordHash);
  if (!matches) {
    await recordAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'auth.login_failed',
      entityType: 'User',
      entityId: user.id,
      detail: 'Incorrect password.',
      ip,
    });
    throw invalid;
  }

  if (!user.isActive) {
    throw ApiError.forbidden('This account has been deactivated. Contact an administrator.');
  }

  // Unverified account: reissue a code and route the user to verification.
  if (!user.emailVerified) {
    await prisma.otpCode.updateMany({
      where: { userId: user.id, purpose: 'EMAIL_VERIFICATION', consumedAt: null },
      data: { consumedAt: new Date() },
    });
    const code = generateOtp();
    await prisma.otpCode.create({
      data: {
        userId: user.id,
        purpose: 'EMAIL_VERIFICATION',
        codeHash: await hashOtp(code),
        expiresAt: new Date(Date.now() + 10 * 60_000),
      },
    });
    await sendEmail({
      to: { email: user.email, name: user.name },
      ...verificationEmail(user.name, code),
    });

    return ok(
      {
        error: 'Your email is not verified yet. We just sent you a fresh 6-digit code.',
        code: 'email_unverified',
        requiresVerification: true,
        email: user.email,
        redirectTo: `/verify-email?email=${encodeURIComponent(user.email)}`,
        devCode: env.showOtpInResponse ? code : undefined,
      },
      403,
    );
  }

  const token = await createSessionToken(user);
  await setSessionCookie(token);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'auth.login',
    entityType: 'User',
    entityId: user.id,
    detail: `Signed in as ${user.role}.`,
    ip,
  });

  return ok({
    message: `Welcome back, ${user.name.split(' ')[0]}.`,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    redirectTo: homeForRole(user.role),
  });
});

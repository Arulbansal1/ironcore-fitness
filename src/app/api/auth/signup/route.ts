import { recordAudit } from '@/lib/audit';
import { generateOtp, hashOtp, hashPassword } from '@/lib/auth';
import { sendEmail, verificationEmail } from '@/lib/email';
import { env } from '@/lib/env';
import { ApiError, clientIp, ok, readJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { colorFromString } from '@/lib/utils';
import { signupSchema } from '@/lib/validation';

const OTP_TTL_MINUTES = 10;

export const POST = route(async (request: Request) => {
  const input = signupSchema.parse(await readJson(request));

  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, emailVerified: true },
  });

  if (existing?.emailVerified) {
    throw ApiError.conflict('An account with that email already exists. Try signing in instead.');
  }

  const passwordHash = await hashPassword(input.password);

  // An unverified signup can be retried — we update the record instead of
  // blocking the user with a "already exists" error they cannot resolve.
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          passwordHash,
          phone: input.phone || null,
        },
      })
    : await prisma.user.create({
        data: {
          email: input.email,
          name: input.name,
          passwordHash,
          phone: input.phone || null,
          role: 'MEMBER',
          avatarColor: colorFromString(input.email),
        },
      });

  // Invalidate any outstanding verification codes, then issue a fresh one.
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
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
    },
  });

  const template = verificationEmail(user.name, code);
  const delivery = await sendEmail({
    to: { email: user.email, name: user.name },
    ...template,
  });

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'auth.signup',
    entityType: 'User',
    entityId: user.id,
    detail: `Account created; verification code sent via ${delivery.transport}.`,
    ip: clientIp(request),
  });

  return ok(
    {
      message: `We sent a 6-digit verification code to ${user.email}. It expires in ${OTP_TTL_MINUTES} minutes.`,
      email: user.email,
      transport: delivery.transport,
      deliveryFailed: !delivery.delivered,
      // Development convenience only — controlled by APP_DEV_SHOW_OTP.
      devCode: env.showOtpInResponse ? code : undefined,
    },
    201,
  );
});

import { generateOtp, hashOtp } from '@/lib/auth';
import { passwordResetEmail, sendEmail, verificationEmail } from '@/lib/email';
import { env } from '@/lib/env';
import { ApiError, ok, readJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { resendOtpSchema } from '@/lib/validation';

const OTP_TTL_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_PER_HOUR = 5;

export const POST = route(async (request: Request) => {
  const input = resendOtpSchema.parse(await readJson(request));

  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // Neutral response so this endpoint cannot be used to enumerate accounts.
  const neutral = ok({
    message: `If an account exists for ${input.email}, a new 6-digit code is on its way.`,
  });

  if (!user) return neutral;
  if (input.purpose === 'EMAIL_VERIFICATION' && user.emailVerified) {
    throw ApiError.badRequest('This email is already verified — you can sign in.');
  }

  const recent = await prisma.otpCode.findFirst({
    where: { userId: user.id, purpose: input.purpose },
    orderBy: { createdAt: 'desc' },
  });

  if (recent) {
    const secondsSince = (Date.now() - recent.createdAt.getTime()) / 1000;
    if (secondsSince < RESEND_COOLDOWN_SECONDS) {
      throw ApiError.tooMany(
        `Please wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSince)} seconds before requesting another code.`,
      );
    }
  }

  const lastHour = await prisma.otpCode.count({
    where: {
      userId: user.id,
      purpose: input.purpose,
      createdAt: { gte: new Date(Date.now() - 3_600_000) },
    },
  });
  if (lastHour >= MAX_PER_HOUR) {
    throw ApiError.tooMany('You have requested too many codes in the last hour. Try again later.');
  }

  await prisma.otpCode.updateMany({
    where: { userId: user.id, purpose: input.purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const code = generateOtp();
  await prisma.otpCode.create({
    data: {
      userId: user.id,
      purpose: input.purpose,
      codeHash: await hashOtp(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
    },
  });

  const template =
    input.purpose === 'PASSWORD_RESET'
      ? passwordResetEmail(user.name, code)
      : verificationEmail(user.name, code);

  const delivery = await sendEmail({ to: { email: user.email, name: user.name }, ...template });

  return ok({
    message: `A new code has been sent to ${user.email}. It expires in ${OTP_TTL_MINUTES} minutes.`,
    transport: delivery.transport,
    deliveryFailed: !delivery.delivered,
    devCode: env.showOtpInResponse ? code : undefined,
  });
});

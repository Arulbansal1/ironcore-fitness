import { generateOtp, hashOtp } from '@/lib/auth';
import { passwordResetEmail, sendEmail } from '@/lib/email';
import { env } from '@/lib/env';
import { ok, readJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { forgotPasswordSchema } from '@/lib/validation';

const OTP_TTL_MINUTES = 10;

export const POST = route(async (request: Request) => {
  const input = forgotPasswordSchema.parse(await readJson(request));
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // Always the same response shape — never reveals whether an account exists.
  const response: Record<string, unknown> = {
    message: `If an account exists for ${input.email}, we've sent a 6-digit reset code. It expires in ${OTP_TTL_MINUTES} minutes.`,
    email: input.email,
  };

  if (user && user.isActive) {
    await prisma.otpCode.updateMany({
      where: { userId: user.id, purpose: 'PASSWORD_RESET', consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const code = generateOtp();
    await prisma.otpCode.create({
      data: {
        userId: user.id,
        purpose: 'PASSWORD_RESET',
        codeHash: await hashOtp(code),
        expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
      },
    });

    const delivery = await sendEmail({
      to: { email: user.email, name: user.name },
      ...passwordResetEmail(user.name, code),
    });

    response.transport = delivery.transport;
    if (env.showOtpInResponse) response.devCode = code;
  }

  return ok(response);
});

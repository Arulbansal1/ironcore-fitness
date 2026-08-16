import { recordAudit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { DEMO_PLANS } from '@/lib/constants';
import { ApiError, clientIp, ok, readJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { demoPaymentSchema } from '@/lib/validation';

/**
 * ─────────────────────────────────────────────────────────────────────────
 *  DEMO PAYMENT GATEWAY — NO REAL MONEY
 * ─────────────────────────────────────────────────────────────────────────
 *  This endpoint SIMULATES a card payment for demonstration purposes only.
 *  It contacts no payment processor, moves no money, and deliberately stores
 *  NO card data: only the brand and last four digits are persisted, exactly
 *  as a real integration would. The outcome is decided from well-known
 *  sandbox test numbers so both success and failure paths are demonstrable.
 * ─────────────────────────────────────────────────────────────────────────
 */

/** Sandbox numbers that always decline, mirroring common gateway test cards. */
const DECLINE_CARDS: Record<string, string> = {
  '4000000000000002': 'card_declined',
  '4000000000009995': 'insufficient_funds',
  '4000000000000069': 'expired_card',
  '4000000000000127': 'incorrect_cvc',
};

function detectBrand(cardNumber: string): string {
  if (/^4/.test(cardNumber)) return 'Visa';
  if (/^5[1-5]/.test(cardNumber) || /^2[2-7]/.test(cardNumber)) return 'Mastercard';
  if (/^3[47]/.test(cardNumber)) return 'American Express';
  if (/^6(?:011|5)/.test(cardNumber)) return 'Discover';
  return 'Card';
}

/** Luhn checksum — a real gateway rejects malformed numbers before charging. */
function passesLuhn(cardNumber: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = cardNumber.length - 1; i >= 0; i -= 1) {
    let digit = Number(cardNumber[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

function isExpired(expiry: string): boolean {
  const [monthPart, yearPart] = expiry.split('/');
  const month = Number(monthPart);
  const year = 2000 + Number(yearPart);
  // Card is valid through the last day of the stated month.
  const expiresAt = new Date(year, month, 1);
  return expiresAt <= new Date();
}

export const GET = route(async () => {
  const user = await requireUser();

  const payments = await prisma.payment.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });

  return ok({
    payments,
    plans: DEMO_PLANS,
    notice: 'DEMO PAYMENT — NO REAL MONEY. These records are simulated.',
  });
});

export const POST = route(async (request: Request) => {
  const user = await requireUser();
  const input = demoPaymentSchema.parse(await readJson(request));

  const plan = DEMO_PLANS.find((p) => p.id === input.plan);
  if (!plan) throw ApiError.badRequest('Unknown plan.');

  const cardNumber = input.cardNumber;
  const last4 = cardNumber.slice(-4);
  const brand = detectBrand(cardNumber);
  const reference = `DEMO-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  // --- simulated gateway decision -----------------------------------------
  let status: 'SUCCEEDED' | 'FAILED' = 'SUCCEEDED';
  let failureCode: string | null = null;

  if (!passesLuhn(cardNumber)) {
    status = 'FAILED';
    failureCode = 'invalid_number';
  } else if (isExpired(input.expiry)) {
    status = 'FAILED';
    failureCode = 'expired_card';
  } else if (DECLINE_CARDS[cardNumber]) {
    status = 'FAILED';
    failureCode = DECLINE_CARDS[cardNumber];
  }

  // A real gateway takes a moment; a tiny delay keeps the UI honest.
  await new Promise((resolve) => setTimeout(resolve, 600));

  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      plan: plan.id,
      amountCents: plan.amountCents,
      currency: 'USD',
      status,
      reference,
      // Only the brand and last four are stored — never the full number, CVC or expiry.
      cardLast4: last4,
      cardBrand: brand,
      failureCode,
      isDemo: true,
    },
  });

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: status === 'SUCCEEDED' ? 'payment.demo_succeeded' : 'payment.demo_failed',
    entityType: 'Payment',
    entityId: payment.id,
    detail: `DEMO PAYMENT (no real money): ${plan.name} — ${status}${failureCode ? ` (${failureCode})` : ''}`,
    metadata: { plan: plan.id, amountCents: plan.amountCents, isDemo: true, failureCode },
    ip: clientIp(request),
  });

  if (status === 'FAILED') {
    const messages: Record<string, string> = {
      invalid_number: 'That card number is not valid. Check the digits and try again.',
      expired_card: 'That card has expired. Use a card with a future expiry date.',
      card_declined: 'The card was declined by the issuer.',
      insufficient_funds: 'The card was declined for insufficient funds.',
      incorrect_cvc: 'The security code (CVC) is incorrect.',
    };

    throw new ApiError(
      402,
      `DEMO PAYMENT DECLINED — ${messages[failureCode ?? ''] ?? 'The card was declined.'}`,
      failureCode ?? 'card_declined',
      { reference, isDemo: true },
    );
  }

  return ok(
    {
      message: `DEMO PAYMENT — NO REAL MONEY. Simulated ${plan.name} payment approved.`,
      payment,
      isDemo: true,
    },
    201,
  );
});

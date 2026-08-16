import { recordAudit } from '@/lib/audit';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { ApiError, ok, route } from '@/lib/http';
import { runSlaSweep } from '@/lib/sla';

// The sweep touches every open ticket and posts to Slack — never cache it.
export const dynamic = 'force-dynamic';

/**
 * SLA breach sweep.
 *
 * Authorised either by the shared `x-cron-secret` header (used by
 * `npm run sla:worker`, a real cron job, or a platform scheduler) or by an
 * authenticated admin session, so it can also be triggered from the console.
 *
 *   curl -X POST http://localhost:3000/api/cron/sla-check \
 *        -H "x-cron-secret: $CRON_SECRET"
 *
 * Idempotent: escalations are unique per (ticket, reason, level), so running it
 * every minute never produces duplicate alerts.
 */
export const POST = route(async (request: Request) => {
  // Vercel Cron cannot send custom headers — it sends `Authorization: Bearer
  // $CRON_SECRET` automatically when CRON_SECRET is set. Accept both that and
  // our own header so the same endpoint works from Vercel, a Unix cron, or the
  // bundled worker.
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const providedSecret = request.headers.get('x-cron-secret') ?? bearer ?? null;
  let triggeredBy = 'cron';
  let actorId: string | null = null;
  let actorEmail: string | null = null;

  if (providedSecret) {
    if (!timingSafeEqual(providedSecret, env.cronSecret)) {
      throw ApiError.unauthorized('Invalid cron secret.');
    }
  } else {
    const user = await getSession();
    if (!user || user.role !== 'ADMIN') {
      throw ApiError.unauthorized(
        'Provide a valid x-cron-secret header, or sign in as an administrator.',
      );
    }
    triggeredBy = 'admin';
    actorId = user.id;
    actorEmail = user.email;
  }

  const startedAt = Date.now();
  const result = await runSlaSweep();
  const durationMs = Date.now() - startedAt;

  // Only record an audit entry when something actually happened, so a
  // once-a-minute worker does not flood the log with no-ops.
  if (result.newEscalations > 0 || triggeredBy === 'admin') {
    await recordAudit({
      actorId,
      actorEmail,
      action: 'sla.sweep',
      entityType: 'System',
      detail: `Checked ${result.checked} open ticket(s); created ${result.newEscalations} escalation(s); Slack ${result.slackSent} sent / ${result.slackFailed} failed.`,
      metadata: { ...result, triggeredBy, durationMs },
    });
  }

  return ok({ ...result, triggeredBy, durationMs, ranAt: new Date().toISOString() });
});

/**
 * Vercel Cron issues a GET, so the sweep must be reachable that way too. A GET
 * carrying a valid secret runs the sweep; a GET without one is just a health
 * probe, so the endpoint stays safe to hit from a browser.
 */
export const GET = route(async (request: Request) => {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const secret = request.headers.get('x-cron-secret') ?? bearer ?? null;
  if (secret && timingSafeEqual(secret, env.cronSecret)) {
    return POST(request);
  }
  return ok({
    endpoint: 'sla-check',
    method: 'POST',
    auth: 'x-cron-secret header, or an authenticated ADMIN session',
    slack: env.slackWebhookUrl ? 'configured' : 'not configured (alerts stay in-app)',
    intervalHint: `${env.slaWorkerIntervalSeconds}s`,
    note: 'Send a valid secret with this GET (or POST) to actually run the sweep.',
  });
});

/** Constant-time comparison so the secret cannot be guessed by timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

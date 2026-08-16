/**
 * Standalone SLA breach monitor.
 *
 * Polls the app's cron endpoint on a fixed interval so SLA breaches are
 * detected and escalated to Slack without an external scheduler.
 *
 *   npm run sla:worker
 *
 * In production you would point a real cron / Kubernetes CronJob at the same
 * endpoint: POST /api/cron/sla-check with header `x-cron-secret: $CRON_SECRET`.
 */
export {}; // Marks this file as a module so its top-level names stay scoped.

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const SECRET = process.env.CRON_SECRET || 'local-dev-cron-secret';
const INTERVAL_SECONDS = Number(process.env.SLA_WORKER_INTERVAL_SECONDS || 60);

let running = true;

async function tick() {
  const startedAt = new Date();
  try {
    const response = await fetch(`${BASE_URL}/api/cron/sla-check`, {
      method: 'POST',
      headers: { 'x-cron-secret': SECRET, 'content-type': 'application/json' },
      signal: AbortSignal.timeout(60_000),
    });

    const body = await response.text();
    if (!response.ok) {
      console.error(`[${startedAt.toISOString()}] ✖ sweep failed (${response.status}): ${body.slice(0, 300)}`);
      return;
    }

    const result = JSON.parse(body) as {
      checked: number;
      newEscalations: number;
      slackSent: number;
      slackFailed: number;
      details: Array<{ ticketNumber: number; reason: string; slack: boolean }>;
    };

    const summary = `checked ${result.checked} · new escalations ${result.newEscalations} · slack ${result.slackSent} sent / ${result.slackFailed} failed`;
    console.log(`[${startedAt.toISOString()}] ✓ ${summary}`);
    for (const detail of result.details) {
      console.log(`    → #${detail.ticketNumber} ${detail.reason} (slack: ${detail.slack ? 'sent' : 'not sent'})`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${startedAt.toISOString()}] ✖ could not reach ${BASE_URL}: ${message}`);
  }
}

function shutdown(signal: string) {
  console.log(`\n${signal} received — stopping SLA worker.`);
  running = false;
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

async function main() {
  console.log(`▸ SLA worker started — polling ${BASE_URL}/api/cron/sla-check every ${INTERVAL_SECONDS}s`);
  console.log('  Press Ctrl+C to stop.\n');

  while (running) {
    await tick();
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_SECONDS * 1000));
  }
}

main();

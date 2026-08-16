/**
 * End-to-end smoke test against a running server.
 *
 *   npm run dev            # in one terminal
 *   npm run smoke          # in another
 *
 * Exercises the real HTTP surface with real cookies: auth, RBAC, the ticket
 * lifecycle, AI draft review, knowledge base retrieval, SLA sweeps and the demo
 * payment gateway. Exits non-zero if anything fails.
 */
const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const PASSWORD = 'Password123';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, actual: unknown, expected: unknown) {
  if (actual === expected) {
    passed += 1;
    console.log(`  [32m✓[0m ${name.padEnd(50)} ${String(actual)}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  [31m✗[0m ${name.padEnd(50)} got ${String(actual)}, want ${String(expected)}`);
  }
}

function info(message: string) {
  console.log(`    [2m${message}[0m`);
}

function section(title: string) {
  console.log(`\n[1m═══ ${title} ═══[0m`);
}

/** Minimal cookie jar so each role keeps its own session. */
class Session {
  private cookie = '';

  async request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ status: number; data: any }> {
    const response = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(this.cookie ? { cookie: this.cookie } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    });

    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      const match = setCookie.match(/sd_session=([^;]*)/);
      if (match) this.cookie = `sd_session=${match[1]}`;
    }

    const text = await response.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text.slice(0, 200);
    }
    return { status: response.status, data };
  }

  get = (path: string) => this.request('GET', path);
  post = (path: string, body?: unknown) => this.request('POST', path, body);
  patch = (path: string, body?: unknown) => this.request('PATCH', path, body);

  async page(path: string): Promise<number> {
    const response = await fetch(`${BASE}${path}`, {
      headers: this.cookie ? { cookie: this.cookie } : {},
      redirect: 'manual',
    });
    return response.status;
  }

  async login(email: string) {
    const result = await this.post('/api/auth/login', { email, password: PASSWORD });
    return result.status;
  }
}

async function main() {
  console.log(`\n[1mSmoke test against ${BASE}[0m`);

  const anon = new Session();
  const member = new Session();
  const staff = new Session();
  const admin = new Session();

  // ---------------------------------------------------------------- public
  section('PUBLIC PAGES & GUARDS');
  for (const path of ['/', '/login', '/signup', '/forgot-password']) {
    check(`GET ${path}`, await anon.page(path), 200);
  }
  check('GET /nonexistent', await anon.page('/nonexistent'), 404);
  for (const path of ['/member', '/staff', '/admin']) {
    check(`GET ${path} unauthenticated redirects`, await anon.page(path), 307);
  }
  check('GET /api/tickets unauthenticated', (await anon.get('/api/tickets')).status, 401);
  check(
    'POST /api/cron/sla-check without secret',
    (await anon.post('/api/cron/sla-check')).status,
    401,
  );

  // ------------------------------------------------------------------ auth
  section('AUTHENTICATION');
  check('login admin', await admin.login('admin@ironcorefitness.example'), 200);
  check('login staff', await staff.login('omar.haddad@ironcorefitness.example'), 200);
  check('login member', await member.login('priya.raman@example.com'), 200);
  check(
    'login with wrong password',
    (await anon.post('/api/auth/login', { email: 'admin@ironcorefitness.example', password: 'nope' }))
      .status,
    401,
  );
  check(
    'signup validation rejects weak input',
    (await anon.post('/api/auth/signup', { name: 'x', email: 'bad', password: 'short' })).status,
    422,
  );

  // Full OTP signup flow.
  const uniqueEmail = `smoke-${Date.now().toString(36)}@example.test`;
  const signup = await anon.post('/api/auth/signup', {
    name: 'Smoke Tester',
    email: uniqueEmail,
    password: 'Passw0rd123',
  });
  check('signup new member', signup.status, 201);
  const otp = signup.data?.devCode;
  check('OTP issued', typeof otp === 'string' && otp.length === 6, true);
  check(
    'verify with wrong OTP rejected',
    (await anon.post('/api/auth/verify-otp', { email: uniqueEmail, code: '000000' })).status,
    400,
  );
  const verified = new Session();
  check(
    'verify with correct OTP signs in',
    (await verified.post('/api/auth/verify-otp', { email: uniqueEmail, code: otp })).status,
    200,
  );
  check('verified session resolves', (await verified.get('/api/auth/me')).data?.user?.email, uniqueEmail);

  // ------------------------------------------------------------------ RBAC
  section('ROLE-BASED ACCESS CONTROL');
  check('member blocked from /staff', await member.page('/staff'), 307);
  check('member blocked from /admin', await member.page('/admin'), 307);
  check('staff blocked from /admin', await staff.page('/admin'), 307);
  check('staff blocked from admin API', (await staff.get('/api/admin/users')).status, 403);
  check('member blocked from analytics API', (await member.get('/api/admin/analytics')).status, 403);
  check('member blocked from staff API', (await member.get('/api/staff')).status, 403);

  // --------------------------------------------------------------- ticket
  section('TICKET LIFECYCLE + AI TRIAGE');
  const created = await member.post('/api/tickets', {
    subject: 'Treadmill 4 belt is slipping badly',
    body: 'The belt on treadmill 4 slips every time I go above about 10kph. It jolted me forward this morning and I nearly came off it. It has been doing it for at least a week and there is no out of order sign on it.',
  });
  check('create ticket', created.status, 201);
  const ticket = created.data.ticket;
  info(
    `#${ticket.number} → ${ticket.category}/${ticket.priority} · sentiment ${ticket.aiSentiment} · confidence ${ticket.aiConfidence}`,
  );
  info(`auto-assigned to ${ticket.assignee?.name ?? 'nobody'} (autoAssigned=${ticket.autoAssigned})`);

  check('triaged into a gym category', ticket.category, 'EQUIPMENT');
  check('safety wording forced urgent priority', ticket.priority, 'URGENT');
  check('safety flag set on the ticket', ticket.safetyFlag, true);
  check('auto-assigned to a staff member', Boolean(ticket.assignee), true);
  check('SLA deadline applied', Boolean(ticket.sla.firstResponse.dueAt), true);

  const ticketId = ticket.id;
  check('member reads own ticket', (await member.get(`/api/tickets/${ticketId}`)).status, 200);

  // AI draft review.
  const draft = await staff.post(`/api/tickets/${ticketId}/suggest`);
  check('staff generates AI draft', draft.status, 201);
  const suggestion = draft.data.suggestion;
  info(
    `draft confidence ${suggestion.confidence} from ${(suggestion.citations as unknown[]).length} source(s) via ${suggestion.model}`,
  );
  check(
    'member cannot generate drafts',
    (await member.post(`/api/tickets/${ticketId}/suggest`)).status,
    403,
  );
  check(
    'staff approves draft',
    (await staff.patch(`/api/suggestions/${suggestion.id}`, { action: 'approve' })).status,
    200,
  );
  check(
    'draft cannot be re-reviewed',
    (await staff.patch(`/api/suggestions/${suggestion.id}`, { action: 'approve' })).status,
    409,
  );

  // Conversation.
  check(
    'staff sends public reply',
    (
      await staff.post(`/api/tickets/${ticketId}/messages`, {
        body: 'Priya, thank you for flagging this — a belt that slips under load is exactly what we want reported. Treadmill 4 is out of service as of now and Tomas is inspecting the drive belt today. I am sorry it nearly threw you.',
      })
    ).status,
    201,
  );
  check(
    'staff adds internal note',
    (
      await staff.post(`/api/tickets/${ticketId}/messages`, {
        body: 'Belt tension out of spec and the deck is worn. Ordering a replacement belt; keep the machine tagged out until it is fitted.',
        isInternal: true,
      })
    ).status,
    201,
  );
  check(
    'member cannot post an internal note',
    (
      await member.post(`/api/tickets/${ticketId}/messages`, {
        body: 'sneaky',
        isInternal: true,
      })
    ).status,
    403,
  );
  check(
    'member replies',
    (
      await member.post(`/api/tickets/${ticketId}/messages`, {
        body: 'Thanks for sorting it so quickly — good to know it was taken out of service straight away.',
      })
    ).status,
    201,
  );

  // Visibility.
  const customerView = await member.get(`/api/tickets/${ticketId}`);
  const agentView = await staff.get(`/api/tickets/${ticketId}`);
  check(
    'internal notes hidden from member',
    customerView.data.messages.some((m: any) => m.isInternal),
    false,
  );
  check('AI drafts hidden from member', customerView.data.suggestions.length, 0);
  check(
    'staff sees internal notes',
    agentView.data.messages.some((m: any) => m.isInternal),
    true,
  );
  check(
    'first-response SLA clock stopped',
    agentView.data.ticket.sla.firstResponse.metAt !== null,
    true,
  );
  info(`timeline has ${agentView.data.events.length} recorded events`);

  // Permissions and closure.
  check(
    'member cannot change priority',
    (await member.patch(`/api/tickets/${ticketId}`, { priority: 'LOW' })).status,
    403,
  );
  check(
    'staff resolves the ticket',
    (await staff.patch(`/api/tickets/${ticketId}`, { status: 'RESOLVED' })).status,
    200,
  );
  check(
    'member rates 5/5',
    (await member.post(`/api/tickets/${ticketId}/rate`, { rating: 5 })).status,
    200,
  );
  check(
    'duplicate rating rejected',
    (await member.post(`/api/tickets/${ticketId}/rate`, { rating: 1 })).status,
    409,
  );

  // --------------------------------------------------------- cross-tenant
  section('CROSS-TENANT ISOLATION');
  const other = new Session();
  await other.login('aisha.khan@example.com');
  check(
    "other member gets 404 on someone else's ticket",
    (await other.get(`/api/tickets/${ticketId}`)).status,
    404,
  );

  // ------------------------------------------------------------------ RAG
  section('KNOWLEDGE BASE & RAG');
  const searches: Array<[string, string]> = [
    ['how do I pause my membership while injured', 'freeze-membership'],
    ['the leg press is broken and looks dangerous', 'broken-equipment'],
    ['spin class was full can I join a waitlist', 'class-booking'],
    ['I want to change my personal trainer', 'personal-training'],
    ['my key fob will not open the turnstile', 'access-and-account'],
    ['what notice do I have to give to cancel', 'cancel-membership'],
  ];
  let hits = 0;
  for (const [query, expectedSlug] of searches) {
    const result = await member.get(`/api/kb/search?query=${encodeURIComponent(query)}&limit=4`);
    const top = result.data.results[0];
    const inTop4 = result.data.results.some((r: any) => r.slug === expectedSlug);
    if (inTop4) hits += 1;
    info(`"${query}" → ${top?.slug} (${top?.similarity}) recall@4=${inTop4 ? 'hit' : 'MISS'}`);
  }
  check('RAG recall@4 across sample queries', hits, searches.length);

  // Admin authors an article and it becomes retrievable immediately.
  const article = await admin.post('/api/kb', {
    title: `Smoke test article ${Date.now().toString(36)}`,
    summary: 'Verifies that a newly created article is chunked and embedded on save.',
    content:
      'This article exists only to prove the indexing pipeline works end to end.\n\nWhen an administrator saves an article it is split into overlapping chunks, each chunk is embedded, and the vectors are written to the pgvector column immediately.\n\nThat means a brand new article is retrievable by the AI on the very next reply draft, with no manual reindex step required.',
    category: 'GENERAL',
    tags: ['smoketest', 'indexing'],
    isPublished: true,
  });
  check('admin creates KB article', article.status, 201);
  check('article was embedded', article.data.chunkCount > 0, true);
  info(`embedded into ${article.data.chunkCount} chunk(s)`);
  check(
    'staff cannot create KB articles',
    (await staff.post('/api/kb', { title: 'nope', summary: 'nope nope', content: 'x'.repeat(50) }))
      .status,
    403,
  );
  const cleanup = await admin.request('DELETE', `/api/kb/${article.data.article.id}`);
  check('admin deletes the article', cleanup.status, 200);

  // ------------------------------------------------------------------ SLA
  section('SLA & ESCALATIONS');
  const sweep = await admin.post('/api/cron/sla-check');
  check('admin can run the breach sweep', sweep.status, 200);
  info(
    `checked ${sweep.data.checked} open ticket(s), ${sweep.data.newEscalations} new escalation(s), Slack ${sweep.data.slackSent} sent / ${sweep.data.slackFailed} failed`,
  );
  const secondSweep = await admin.post('/api/cron/sla-check');
  check('sweep is idempotent', secondSweep.data.newEscalations, 0);

  const escalation = await staff.post('/api/escalations', {
    ticketId,
    detail: 'Smoke test escalation — member is a top-tier account.',
  });
  check('staff raises a manual escalation', escalation.status, 201);
  check(
    'duplicate manual escalation rejected',
    (await staff.post('/api/escalations', { ticketId, detail: 'again' })).status,
    409,
  );
  check(
    'escalation can be acknowledged',
    (await staff.patch(`/api/escalations/${escalation.data.escalation.id}`, { action: 'acknowledge' }))
      .status,
    200,
  );
  check(
    'escalation can be resolved',
    (await staff.patch(`/api/escalations/${escalation.data.escalation.id}`, { action: 'resolve' }))
      .status,
    200,
  );
  check(
    'resolved escalation cannot be re-resolved',
    (await staff.patch(`/api/escalations/${escalation.data.escalation.id}`, { action: 'resolve' }))
      .status,
    409,
  );

  // --------------------------------------------------------------- admin
  section('ADMIN CONTROLS');
  const analytics = await admin.get('/api/admin/analytics?range=30');
  check('analytics API', analytics.status, 200);
  info(
    `SLA first-response ${analytics.data.sla.firstResponseCompliance}% over ${analytics.data.sla.firstResponseMeasured} decided tickets · AI acceptance ${analytics.data.ai.acceptanceRate}%`,
  );
  check('analytics volume series is gap-filled', analytics.data.volume.length, 31);

  const me = await admin.get('/api/auth/me');
  const adminId = me.data.user.id;
  check(
    'admin cannot demote themselves',
    (await admin.patch(`/api/admin/users/${adminId}`, { role: 'MEMBER' })).status,
    400,
  );
  check(
    'admin cannot deactivate themselves',
    (await admin.patch(`/api/admin/users/${adminId}`, { isActive: false })).status,
    400,
  );
  check(
    'SLA policy rejects resolution < first response',
    (
      await admin.request('PUT', '/api/admin/sla', {
        priority: 'HIGH',
        name: 'Invalid',
        firstResponseMins: 500,
        resolutionMins: 100,
        escalateAfterMins: 30,
        notifySlack: true,
        isActive: true,
      })
    ).status,
    400,
  );
  check(
    'SLA policy accepts a valid update',
    (
      await admin.request('PUT', '/api/admin/sla', {
        priority: 'HIGH',
        name: 'High — broken core feature',
        firstResponseMins: 60,
        resolutionMins: 480,
        escalateAfterMins: 30,
        notifySlack: true,
        isActive: true,
      })
    ).status,
    200,
  );
  check('audit log API', (await admin.get('/api/admin/audit')).status, 200);

  // ------------------------------------------------------- demo payments
  section('DEMO PAYMENT GATEWAY (no real money)');
  const success = await member.post('/api/payments', {
    plan: 'ELITE',
    cardNumber: '4242 4242 4242 4242',
    expiry: '12/30',
    cvc: '123',
    name: 'Priya Raman',
  });
  check('valid test card approved', success.status, 201);
  check('payment flagged as demo', success.data.payment.isDemo, true);
  check('full card number never stored', success.data.payment.cardLast4, '4242');
  check(
    'declining test card is declined',
    (
      await member.post('/api/payments', {
        plan: 'BASIC',
        cardNumber: '4000 0000 0000 9995',
        expiry: '12/30',
        cvc: '123',
        name: 'Priya Raman',
      })
    ).status,
    402,
  );
  check(
    'Luhn-invalid card rejected',
    (
      await member.post('/api/payments', {
        plan: 'BASIC',
        cardNumber: '1234 5678 9012 3456',
        expiry: '12/30',
        cvc: '123',
        name: 'Priya Raman',
      })
    ).status,
    402,
  );
  check(
    'expired card rejected',
    (
      await member.post('/api/payments', {
        plan: 'BASIC',
        cardNumber: '4242 4242 4242 4242',
        expiry: '01/24',
        cvc: '123',
        name: 'Priya Raman',
      })
    ).status,
    402,
  );

  // ----------------------------------------------------------------- pages
  section('RENDERED PAGES');
  const pages: Array<[Session, string]> = [
    [member, '/member'],
    [member, '/member/tickets'],
    [member, '/member/tickets/new'],
    [member, '/member/knowledge-base'],
    [member, '/member/knowledge-base/freeze-membership'],
    [member, '/member/classes'],
    [member, '/member/membership'],
    [member, '/member/billing'],
    [member, `/member/tickets/${ticketId}`],
    [staff, '/staff'],
    [staff, '/staff/tickets'],
    [staff, '/staff/ai-drafts'],
    [staff, '/staff/escalations'],
    [staff, '/staff/knowledge-base'],
    [staff, '/staff/classes'],
    [staff, `/staff/tickets/${ticketId}`],
    [admin, '/admin'],
    [admin, '/admin/analytics'],
    [admin, '/admin/analytics?range=7'],
    [admin, '/admin/tickets'],
    [admin, '/admin/users'],
    [admin, '/admin/knowledge-base'],
    [admin, '/admin/knowledge-base/new'],
    [admin, '/admin/sla'],
    [admin, '/admin/escalations'],
    [admin, '/admin/audit'],
  ];
  for (const [session, path] of pages) {
    check(`GET ${path}`, await session.page(path), 200);
  }

  // --------------------------------------------------------------- logout
  section('SESSION TEARDOWN');
  check('logout', (await member.post('/api/auth/logout')).status, 200);
  check('session cleared', (await member.get('/api/auth/me')).data.user, null);

  // ---------------------------------------------------------------- result
  console.log(
    `\n[1m${failed === 0 ? '[32mALL CHECKS PASSED' : '[31mFAILURES'}[0m  ${passed} passed, ${failed} failed\n`,
  );
  if (failed > 0) {
    console.log('Failed checks:');
    for (const failure of failures) console.log(`  · ${failure}`);
    console.log('');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n[31mSmoke test crashed:[0m', error);
  process.exit(1);
});

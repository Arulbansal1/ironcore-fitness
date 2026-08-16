# IronCore Fitness — Member Support Desk

A complete member support platform for a gym: ticketing with live chat and photo
attachments, automatic AI triage (category, priority, sentiment, summary),
**instant escalation of anything involving injury or a safety hazard**,
retrieval-augmented reply drafts a staff member approves, full membership and
class context on every ticket, SLA timers with Slack alerts, and analytics —
across three role-based dashboards.

Built with **Next.js 15 (App Router) · TypeScript · PostgreSQL + pgvector ·
Prisma · Tailwind CSS · OpenAI · Brevo · Docker**.

> **DEMO PAYMENT — NO REAL MONEY.** The membership checkout simulates a card
> gateway for demonstration only. No payment processor is contacted, no money
> moves, and no card details are stored (only brand + last four, exactly as a
> real integration would).

## The gym domain

| Concept | What it does |
|---|---|
| **Members** | Membership record with tier (Day pass / Basic / Pro / Elite), status (active, frozen, expired, cancelled), member number, renewal date, goals, emergency contact and staff-only medical notes |
| **Staff** | Front desk, floor technicians and personal trainers, each with support specialties that drive auto-assignment, plus certifications and availability |
| **Classes** | A weekly timetable with trainer, room, capacity and intensity. Members book, waitlist and cancel; cancelling promotes the next person off the waitlist automatically |
| **Check-ins** | Turnstile history, surfaced as "visits this month" on the member record so staff can see engagement at a glance |
| **Tickets** | Nine gym categories: membership & billing, equipment & facilities, classes, personal training, nutrition, injury & medical, account & access, complaints, general |

### Safety comes first, structurally

A gym support desk has one failure mode that outranks all others: a member
reporting an injury or a hazard sitting unread in a queue. So it is not left to
an SLA timer.

A deterministic keyword scan runs on every incoming ticket — **including when
OpenAI is doing the classification**, so a bad completion cannot let an injury
slip through. When it fires the ticket is forced to `URGENT`, tagged with a
`safetyFlag`, categorised as injury or equipment, and escalated to the duty
manager with a Slack alert **on arrival**, before any response timer starts.

It matches near-misses too ("the belt slipped and I nearly came off"), because
those are reported before anyone is hurt, which is exactly when acting is
cheapest.

---

## Table of contents

- [Quick start](#quick-start)
- [What it does](#what-it-does)
- [Demo accounts](#demo-accounts)
- [How the AI works](#how-the-ai-works)
- [SLA and escalation](#sla-and-escalation)
- [Architecture](#architecture)
- [Environment variables](#environment-variables)
- [Running without API keys](#running-without-api-keys)
- [Scripts](#scripts)
- [Docker](#docker)
- [Project structure](#project-structure)
- [API reference](#api-reference)
- [Security notes](#security-notes)
- [Troubleshooting](#troubleshooting)

---

## Quick start

**Requirements:** Node.js 20+ and Docker (for PostgreSQL with pgvector).

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#    Then set AUTH_SECRET to a long random string:
#    openssl rand -base64 48

# 3. Start PostgreSQL (pgvector extension is created automatically)
docker compose up -d db

# 4. Create the schema and load demo data
npm run db:push
npm run db:seed

# 5. Verify everything is wired up
npm run setup

# 6. Run it
npm run dev
```

Open <http://localhost:3000> and sign in with any account from
[Demo accounts](#demo-accounts) — the password is `Password123`.

**Optionally**, in a second terminal, start the SLA breach monitor:

```bash
npm run sla:worker
```

No API keys are required. The app runs fully end-to-end without them — see
[Running without API keys](#running-without-api-keys).

---

## What it does

### Members

- Sign up, verify email with a **6-digit OTP delivered by Brevo**, reset password
- Create tickets with file attachments (10 MB, 14 file types)
- See suggested knowledge base articles **while typing**, before submitting
- Chat with staff in a threaded conversation; new replies appear automatically
- Watch a **live SLA countdown** on their own ticket
- Browse the help centre with semantic search
- View a complete, immutable ticket history
- Rate resolved tickets (1–5 CSAT)
- Run a clearly-marked **demo checkout** (no real money)

### Staff & trainers

- Prioritised queue with live SLA timers, sorted by priority or nearest deadline
- Full ticket workspace: conversation, internal notes, attachments, history
- **Review AI reply drafts** — approve, edit-and-approve, or reject. The AI never
  sends anything to a member; a human always presses send
- See which knowledge base articles a draft cited, with relevance scores
- Inline knowledge base search pre-seeded with the ticket text
- Reassign, re-prioritise, change status; member's prior tickets in the sidebar
- Raise a manual escalation that posts to Slack immediately
- Acknowledge and resolve escalations

### Admins

Everything staff can do, plus:

- **Users & staff** — change roles, deactivate accounts, configure staff member
  specialties and capacity (which drives auto-assignment)
- **Knowledge base** — write, edit, publish and delete articles. Saving
  automatically re-chunks and re-embeds them, so retrieval never drifts from the text
- **SLA policies** — per-priority first-response and resolution targets, Slack
  toggle, and a manual "run breach sweep now" button
- **Escalations** — every breach with its Slack delivery status
- **Audit log** — append-only record of every privileged action, filterable
- **Analytics** — volume over time, response-time percentiles, SLA compliance,
  sentiment mix, backlog ageing, per-staff member performance, and AI acceptance rate

---

## Demo accounts

All seeded accounts use the password **`Password123`**.

| Role | Email | Notes |
|---|---|---|
| Manager | `admin@ironcorefitness.example` | Full access to everything |
| Staff | `maya.chen@ironcorefitness.example` | Membership Services Lead — billing, accounts, complaints |
| Staff | `omar.haddad@ironcorefitness.example` | Head of S&C — personal training, injury, nutrition |
| Staff | `elena.novak@ironcorefitness.example` | Group Fitness Manager — classes |
| Staff | `tomas.berg@ironcorefitness.example` | Equipment Technician — equipment & facilities |
| Member | `priya.raman@example.com` | IC-00412 · **Elite**, active · 18 visits this month |
| Member | `daniel.okafor@example.com` | IC-00517 · Pro, active |
| Member | `sofia.marino@example.com` | IC-00298 · Pro, **frozen** for knee rehab — booking blocked |
| Member | `james.whitfield@example.com` | IC-00631 · Basic, active · new joiner |
| Member | `aisha.khan@example.com` | IC-00455 · Elite, active · has the **injury** ticket |
| Member | `lucas.pereira@example.com` | IC-00702 · Basic, **expired** · billed after cancelling |

The seed loads 12 tickets across every status, priority and gym category — with
real conversations, AI triage output, safety escalations and SLA state — plus 8
classes with bookings, turnstile check-in history, and 14 gym policy articles.

---

## How the AI works

### 1. Triage on arrival

When a ticket is created, `runTriagePipeline()` (`src/lib/triage.ts`) runs
inline so the member sees the result immediately:

1. **Classify** — category, priority, sentiment, a one-line summary for the
   staff member, keyword tags, and a confidence score
2. **Apply SLA** — look up the active policy for that priority and set absolute
   first-response and resolution deadlines
3. **Auto-assign** — pick the staff member whose specialties match the category and who
   has the most spare capacity (`specialty match → load → fewest open tickets`);
   staff at capacity or marked unavailable are skipped
4. **Draft a reply** — retrieve knowledge base context and store a reviewable
   draft with citations

Every step is best-effort. A failure is logged and the ticket stays fully usable —
triage failing must never block a member from filing a ticket.

### 2. Retrieval (RAG)

`src/lib/rag.ts` runs **hybrid retrieval** — two independent retrievers over the
same chunks, fused into one score:

- **Dense** — pgvector cosine similarity over 1536-dimension embeddings (semantic)
- **Sparse** — PostgreSQL full-text search with weighted `ts_rank` (lexical)

Both matter. Dense retrieval alone misses exact identifiers (`INV-8846`, `401`);
lexical alone misses paraphrases ("money taken twice" → "duplicate charge").

Three details make the lexical arm actually work:

- **OR semantics.** `websearch_to_tsquery` ANDs every term, so a natural-language
  question matches nothing. The query is rebuilt as an OR of prefix-matched
  lexemes, with ranking doing the discrimination.
- **IDF pruning.** Terms appearing in more than 40% of the corpus are dropped —
  otherwise a common word like "account" drowns out the one rare word that
  identifies the right document.
- **Flattened weights.** Postgres defaults to a title weight of 1.0, which lets a
  single common word in a title outrank several rare words in the body.

The two signals fuse probabilistically — `relevance = 1 − (1 − dense)(1 − sparse)` —
so ranking and the displayed score come from the same number and can never
disagree.

Measured on a 12-query benchmark against the seeded knowledge base, using the
**local fallback engine** (no OpenAI key): **10/12 top-1 correct, 11/12 recall@4**.
Recall@4 is the number that matters, since the top 4 chunks become the model's
context. With `OPENAI_API_KEY` set, semantic paraphrase matching improves further.

### 3. Drafting and human review

Drafts are grounded in the retrieved excerpts and instructed never to invent
policy, pricing or timelines. Confidence blends the model's self-assessment with
retrieval quality (60/40), so a confident-sounding answer with no supporting
article cannot report high confidence.

**The AI never contacts a member.** A draft is `PENDING` until a staff member
approves, edits, or rejects it — and even approval only loads the text into the
composer. The staff member still presses send. Every review is recorded on the ticket
timeline and in the audit log, and messages sent from a draft are tagged
"AI-assisted".

---

## SLA and escalation

Each priority has a policy with a first-response and a resolution target,
measured from ticket creation. Deadlines are stored as absolute timestamps, so
the countdown is authoritative and the browser just ticks it.

**Breach detection** runs as a sweep:

```bash
# The bundled worker (polls on an interval)
npm run sla:worker

# Or point any scheduler at the endpoint
curl -X POST http://localhost:3000/api/cron/sla-check \
     -H "x-cron-secret: $CRON_SECRET"
```

On each new breach the sweep:

1. Creates an escalation, unique per `(ticket, reason, level)` — so running the
   sweep every minute never produces duplicate alerts
2. Raises the escalation **level every 2 hours** the breach stays unresolved
3. Posts a Slack Block Kit alert with the ticket, member, assignee, overdue
   time and a deep link
4. Notifies the assignee and all admins in-app
5. Records a ticket event and an audit entry

Escalations are also raised when a member message contains strong negative
sentiment, and manually by a staff member.

Admins can trigger the sweep from **Admin → SLA policies → Run breach sweep now**
(authenticated as admin, no secret needed).

---

## Architecture

```
Browser
  │
  ├── Next.js App Router (React 19 server + client components)
  │     ├── middleware.ts        Edge JWT check, role-based route guards
  │     └── app/api/*            Route handlers (the entire backend)
  │
  ├── src/lib/
  │     ├── auth.ts              JWT sessions (jose) in httpOnly cookies, bcrypt
  │     ├── triage.ts            Triage pipeline + auto-assignment
  │     ├── ai.ts                OpenAI client + local fallback engine
  │     ├── rag.ts               Hybrid retrieval, chunking, embedding
  │     ├── sla.ts               Deadlines, live clocks, breach sweep
  │     ├── analytics.ts         SQL-side aggregation
  │     ├── email.ts             Brevo transactional email
  │     ├── slack.ts             Incoming webhook alerts
  │     ├── audit.ts             Audit log, ticket timeline, notifications
  │     └── uploads.ts           Private file storage + validation
  │
  └── PostgreSQL 16 + pgvector
        └── Prisma ORM (raw SQL for vector + analytics work)
```

**Design decisions worth calling out:**

- **Authorisation is enforced server-side, not in middleware.** Middleware only
  verifies the signed token for fast redirects; `requireUser()` re-reads the
  database on every request, so a role change or deactivation takes effect
  immediately and a stale token can never grant real access.
- **Members get 404, not 403,** when probing another member's ticket — a 403
  would confirm the ticket exists.
- **Attachments live outside `public/`** and are served only through an
  authenticated route that re-checks ticket access.
- **Analytics aggregate in SQL,** including percentiles and gap-filled time
  series. The ticket table is the one thing guaranteed to grow.
- **SLA compliance counts a ticket once its outcome is decided** — answered, or
  past its deadline. Counting only answered tickets would hide every outstanding
  breach behind a flattering number.
- **Chat uses polling, not WebSockets.** Reliable, no extra infrastructure, and
  honest about what it is.

---

## Environment variables

Copy `.env.example` to `.env`. Only two variables are required.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string (needs pgvector) |
| `AUTH_SECRET` | **Yes** | Session JWT signing key, 32+ chars |
| `AUTH_SESSION_DAYS` | No | Session lifetime (default 7) |
| `NEXT_PUBLIC_APP_URL` | No | Base URL used in emails and Slack links |
| `BREVO_API_KEY` | No | Sends real OTP emails; falls back to console |
| `BREVO_SENDER_EMAIL` / `BREVO_SENDER_NAME` | No | Email sender identity |
| `APP_DEV_SHOW_OTP` | No | Shows the OTP in the UI for local demos. **Never enable in production** |
| `OPENAI_API_KEY` | No | Enables the OpenAI triage + embeddings |
| `OPENAI_CHAT_MODEL` | No | Default `gpt-4o-mini` |
| `OPENAI_EMBEDDING_MODEL` | No | Default `text-embedding-3-small` |
| `SLACK_WEBHOOK_URL` | No | Posts SLA breach alerts |
| `SLACK_ALERT_CHANNEL` | No | Channel override |
| `CRON_SECRET` | No | Shared secret for the SLA sweep endpoint |
| `SLA_WORKER_INTERVAL_SECONDS` | No | Worker poll interval (default 60) |
| `UPLOAD_DIR` / `MAX_UPLOAD_MB` | No | Attachment storage and size cap |

---

## Running without API keys

Every optional integration degrades to a documented local fallback, so the
project is fully demonstrable with nothing but a database. The active engine is
always labelled in the UI — never silently faked.

| Missing key | Fallback | What still works |
|---|---|---|
| `BREVO_API_KEY` | Console transport | The OTP is printed to the server log and (with `APP_DEV_SHOW_OTP=true`) shown in the UI. Signup, verification and password reset all complete. |
| `OPENAI_API_KEY` | Local engine | A keyword-rule classifier for category/priority/sentiment, extractive summarisation, and a **feature-hashing vectoriser** with stemming and bigrams for embeddings. Combined with the lexical retrieval arm this scores 11/12 recall@4 on the seeded corpus. Drafts are assembled from the top retrieved passage using a professional template. |
| `SLACK_WEBHOOK_URL` | In-app only | Escalations are still created, levelled, recorded and shown in the Escalations screen with "Slack not sent" status. |

> **Switching engines:** OpenAI and local embeddings are not comparable vectors.
> After adding or removing `OPENAI_API_KEY`, run `npm run kb:reindex` to rebuild
> the index with a single consistent model.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run setup` | Verifies env, database, pgvector, schema, and reports integration status |
| `npm run db:push` | Applies the Prisma schema |
| `npm run db:seed` | Loads demo data (idempotent) |
| `npm run db:reset` | Wipes and reseeds |
| `npm run db:studio` | Prisma Studio |
| `npm run kb:reindex` | Rebuilds every knowledge base embedding |
| `npm run sla:worker` | Runs the SLA breach monitor |
| `npm run smoke` | End-to-end HTTP test suite against a running server |
| `npm run typecheck` | TypeScript, no emit |

### Verifying it works

With the server running, `npm run smoke` exercises the real HTTP surface with
real sessions — auth and the OTP flow, RBAC on every role boundary, the full
ticket lifecycle, AI draft review, internal-note visibility, cross-tenant
isolation, RAG recall, SLA sweeps and idempotency, admin safety guards, the demo
payment paths, and every rendered page:

```
ALL CHECKS PASSED  103 passed, 0 failed
```

---

## Docker

Database only (recommended for development):

```bash
docker compose up -d db
```

The whole application:

```bash
docker compose --profile app up --build
```

The app container applies the schema and seeds itself on first boot
(`SKIP_SEED=true` to disable), then serves on <http://localhost:3000>.

---

## Project structure

```
prisma/
  schema.prisma            15 models, pgvector column, enums
  seed.ts / seed-data.ts   Demo dataset
  init/                    CREATE EXTENSION vector (runs on container boot)
scripts/
  setup.ts                 Environment + database health check
  sla-worker.ts            Standalone SLA breach monitor
  reindex-kb.ts            Rebuild all embeddings
src/
  middleware.ts            Edge auth + role routing
  app/
    (auth)/                login, signup, verify-email, forgot/reset password
    member/              overview, tickets, help centre, demo billing
    staff member/                 overview, queue, workspace, AI drafts, escalations
    admin/                 overview, analytics, users, KB, SLA, escalations, audit
    api/                   All backend route handlers
  components/
    ui/                    Button, Field, Card, Badge, Modal, Toast, Pagination…
    layout/                Responsive app shell, notification panel
    tickets/               Conversation, SLA timer, AI draft panel, timeline
    charts/                Validated palette, volume chart, bar breakdowns
    escalations/           Escalation table
  lib/                     Business logic (see Architecture)
```

---

## API reference

All endpoints return JSON. Errors are `{ error, code, details? }` with a
meaningful HTTP status.

**Auth** — `POST /api/auth/signup` · `login` · `logout` · `verify-otp` ·
`resend-otp` · `forgot-password` · `reset-password` · `GET /api/auth/me`

**Tickets** — `GET|POST /api/tickets` · `GET|PATCH /api/tickets/[id]` ·
`GET|POST /api/tickets/[id]/messages` · `GET|POST /api/tickets/[id]/attachments` ·
`POST /api/tickets/[id]/rate` · `POST /api/tickets/[id]/suggest`

**AI & knowledge base** — `PATCH /api/suggestions/[id]` (approve/edit/reject) ·
`GET|POST /api/kb` · `GET|PATCH|DELETE|POST /api/kb/[id]` · `GET /api/kb/search`

**Escalations & SLA** — `GET|POST /api/escalations` ·
`PATCH /api/escalations/[id]` · `POST /api/cron/sla-check`

**Admin** — `GET /api/admin/users` · `PATCH /api/admin/users/[id]` ·
`GET|PUT /api/admin/sla` · `GET /api/admin/analytics` · `GET /api/admin/audit`

**Other** — `GET /api/attachments/[id]` · `GET|PATCH /api/notifications` ·
`GET|POST /api/payments` (demo)

---

## Security notes

- Passwords are bcrypt-hashed (cost 11); OTP codes are hashed too, never stored
  in plaintext
- Sessions are HS256 JWTs in `httpOnly`, `sameSite=lax` cookies, `secure` in
  production
- OTPs are cryptographically random, expire in 10 minutes, are single-use, and
  are invalidated when a newer code is issued
- Rate limiting: 5 verification attempts per code, 60-second resend cooldown,
  5 codes per hour
- Login and password-reset responses are identical for unknown and known
  addresses — no account enumeration
- File uploads are validated by extension and size, stored outside the web root
  with generated names, and served only through an authenticated route
- The SLA cron endpoint uses a constant-time secret comparison
- An admin cannot demote or deactivate themselves, and the system always retains
  at least one active admin
- Every privileged action is written to an append-only audit log

**Not production-hardened:** rate limiting is per-record rather than per-IP,
there is no CSRF token beyond `sameSite` cookies, and uploads are stored on local
disk. This is a showcase build.

---

## Troubleshooting

**`pgvector` extension missing** — The `pgvector/pgvector:pg16` image creates it
on first boot via `prisma/init/`. If you use your own PostgreSQL, run
`CREATE EXTENSION vector;` first.

**Database unreachable** — `docker compose up -d db`, then `npm run setup`.

**`AUTH_SECRET is missing or shorter than 32 characters`** — Generate one with
`openssl rand -base64 48` and put it in `.env`.

**No OTP email arrives** — Without `BREVO_API_KEY` the code is printed to the
server log and shown in the UI. Look for the `EMAIL (console transport)` block.

**Retrieval results look poor after adding an OpenAI key** — Run
`npm run kb:reindex`. Vectors from different models are not comparable.

**Seed says tickets already exist** — The seed is idempotent and skips tickets it
has already created. Use `npm run db:reset` for a clean slate.

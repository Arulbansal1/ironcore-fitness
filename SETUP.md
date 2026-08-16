# Setup guide

Step-by-step setup, from a clean machine to a running demo. For what the project
does and how it works, see [README.md](./README.md).

---

## 1. Prerequisites

| Tool | Version | Check |
|---|---|---|
| Node.js | 20 or newer | `node -v` |
| npm | 10 or newer | `npm -v` |
| Docker | any recent | `docker --version` |

Docker is used to run PostgreSQL with the `pgvector` extension. If you already
have PostgreSQL 14+ with pgvector installed, you can skip Docker — see
[Using your own PostgreSQL](#using-your-own-postgresql).

---

## 2. Install dependencies

```bash
npm install
```

This also generates the Prisma client.

---

## 3. Create your `.env`

```bash
cp .env.example .env
```

Then open `.env` and set **one** required value:

```bash
# Generate a secret:
openssl rand -base64 48
```

Paste the result into `AUTH_SECRET`. The app refuses to start with a missing or
short secret — signing sessions with a weak key is unsafe, so this fails loudly
rather than silently.

`DATABASE_URL` is already correct for the bundled Docker database. Every other
variable is optional.

---

## 4. Start the database

```bash
docker compose up -d db
```

Wait a few seconds, then confirm it is healthy:

```bash
docker compose ps
```

The container creates the `vector` extension automatically on first boot
(via `prisma/init/001-extensions.sql`).

---

## 5. Create the schema and load demo data

```bash
npm run db:push     # creates all tables
npm run db:seed     # loads users, tickets, knowledge base, SLA policies
```

The seed prints a summary and the demo login credentials.

It is **idempotent** — re-running upserts users and articles and skips tickets
that already exist. For a completely clean slate:

```bash
npm run db:reset
```

---

## 6. Verify

```bash
npm run setup
```

Expected output:

```
  ✓ .env file found
  ✓ DATABASE_URL set
  ✓ AUTH_SECRET set

  ✓ Database reachable
  ✓ pgvector extension installed
  ✓ Schema applied (15 tables)
    users: 10 · tickets: 12 · kb articles: 14 · vectors: 28

  Optional integrations:
    Email  · console fallback (OTP printed to server log)
    AI     · local engine (keyword triage + hashing embeddings)
    Slack  · disabled (escalations stored in-app only)

✓ Everything checks out. Start the app with: npm run dev
```

Anything marked `✖` tells you exactly what to fix.

---

## 7. Run

```bash
npm run dev
```

Open <http://localhost:3000>.

Optionally, in a second terminal, run the SLA breach monitor:

```bash
npm run sla:worker
```

To confirm everything actually works end to end, run the test suite against the
running server:

```bash
npm run smoke
```

It signs in as each role and exercises auth, RBAC, the ticket lifecycle, AI draft
review, RAG retrieval, SLA sweeps, admin guards, demo payments and every page —
103 checks in total.

---

## 8. Sign in

Password for every seeded account: **`Password123`**

| Role | Email |
|---|---|
| Admin | `admin@ironcorefitness.example` |
| Staff | `omar.haddad@ironcorefitness.example` |
| Customer | `priya.raman@example.com` |

The login screen also has one-click buttons that fill these in.

---

## A five-minute demo walkthrough

A path that exercises every major feature in order.

**1. Sign up as a brand-new member** (`/signup`)
Use any email. Because Brevo is not configured, the 6-digit code is printed to
your terminal *and* shown in a blue box on the verification screen. Enter it —
you are signed in automatically.

**2. Create a ticket** (`/member/tickets/new`)
Report a hazard, e.g.:

> *Subject:* `Cable on the lat pulldown is frayed`
> *Body:* `The cable on the lat pulldown is visibly frayed near the top pulley. It jolted badly on my last set and I nearly came off the seat. Nobody has put an out of order sign on it.`

Watch as you type — matching help articles appear beneath the box.

Submit, and observe on the ticket page: it was classified **Equipment &
facilities**, forced to **Urgent** by the safety scan, given a **15-minute
first-response SLA** with a live countdown, auto-assigned to Tomas Berg (the
equipment technician), and **escalated to the duty manager immediately** — the
red banner at the top of the staff view, raised before any timer expired.

**3. Look at the history tab** — the full triage decision chain is recorded.

**4. Sign out and sign in as staff** (`tomas.berg@ironcorefitness.example`)
Open the ticket from the queue. The right-hand column shows the SLA timers, the
AI triage result with its confidence, and the **member context panel**: their
tier, whether the membership is active or frozen, visits this month, upcoming
classes, and — on injury tickets only — medical notes and emergency contact.

**5. Review the AI draft**
Below the conversation, the AI has drafted a reply. Note the **citations** — the
exact knowledge base articles it retrieved, with relevance scores — and the
confidence badge. Click **Edit**, adjust a line, then **Save & approve**. The
text loads into the reply box. Press **Send reply**.

The first-response SLA clock stops and turns green. The message is tagged
"AI-assisted".

**6. Add an internal note** — tick "Internal note" and send. Sign back in as the
member: the note is not there.

**7. Trigger an SLA breach and a Slack alert**
As an admin (`admin@ironcorefitness.example`), go to **SLA policies** and click
**Run breach sweep now**. The seeded dataset contains overdue tickets, so
escalations are created. Check **Escalations** — each shows its Slack delivery
status. Set `SLACK_WEBHOOK_URL` in `.env` and restart to send them for real.

**8. Write a knowledge base article** (**Admin → Knowledge base → New article**)
Save it, then go back to any ticket and click **Regenerate** on the AI draft. The
new article is already embedded, retrieved, and cited — the confidence score
rises.

**9. Analytics** (**Admin → Analytics**)
Volume over time, response-time percentiles, SLA compliance, sentiment mix,
backlog ageing, per-staff member performance, and AI acceptance rate. Toggle any chart
to a table; toggle dark mode in the top bar.

**10. Membership and classes** (**Member → My membership**, **Member → Classes**)
Sign in as `sofia.marino@example.com` to see a **frozen** membership: the banner
explains the holding fee, and class booking is blocked with a clear reason. As
`priya.raman@example.com`, book and cancel a class — cancelling promotes the
first waitlisted member into the free place automatically.

**11. Demo payment** (**Member → Billing**)
Clearly marked **DEMO PAYMENT — NO REAL MONEY**. Use the listed test cards:
`4242 4242 4242 4242` succeeds, `4000 0000 0000 9995` declines for insufficient
funds. No processor is contacted.

---

## Enabling the optional integrations

### Brevo (real OTP emails)

1. Create a free account at <https://www.brevo.com>
2. Generate an API key at <https://app.brevo.com/settings/keys/api>
3. In `.env`:
   ```bash
   BREVO_API_KEY="xkeysib-…"
   BREVO_SENDER_EMAIL="no-reply@yourdomain.com"
   APP_DEV_SHOW_OTP="false"
   ```
4. Restart. Verify the sender address in Brevo first, or delivery will fail.

### OpenAI (semantic AI)

1. Create a key at <https://platform.openai.com/api-keys>
2. In `.env`:
   ```bash
   OPENAI_API_KEY="sk-…"
   ```
3. Restart, then **rebuild the vector index**:
   ```bash
   npm run kb:reindex
   ```

> This step matters. OpenAI and local embeddings are different vector spaces —
> mixing them silently degrades retrieval. The reindex makes the whole corpus
> consistent.

### Slack (breach alerts)

1. Create an Incoming Webhook: <https://api.slack.com/messaging/webhooks>
2. In `.env`:
   ```bash
   SLACK_WEBHOOK_URL="https://hooks.slack.com/services/…"
   SLACK_ALERT_CHANNEL="#support-alerts"
   ```
3. Restart, then trigger a sweep from **Admin → SLA policies → Run breach sweep now**

---

## Using your own PostgreSQL

You need PostgreSQL 14+ with the `pgvector` extension.

```sql
CREATE DATABASE support_desk;
\c support_desk
CREATE EXTENSION IF NOT EXISTS vector;
```

Then update `DATABASE_URL` in `.env` and run `npm run db:push && npm run db:seed`.

---

## Running everything in Docker

```bash
docker compose --profile app up --build
```

This builds the app image, starts PostgreSQL, applies the schema, seeds the demo
data, and serves on <http://localhost:3000>.

Pass through optional keys from your shell environment:

```bash
OPENAI_API_KEY=sk-… SLACK_WEBHOOK_URL=https://… docker compose --profile app up --build
```

Set `SKIP_SEED=true` to skip seeding on boot.

---

## Production build

```bash
npm run build
npm start
```

Before deploying:

- Set a strong `AUTH_SECRET`
- Set `APP_DEV_SHOW_OTP=false` (otherwise OTPs are exposed in API responses)
- Set `CRON_SECRET` to something unguessable
- Set `NEXT_PUBLIC_APP_URL` to the real URL, so email and Slack links work
- Point `UPLOAD_DIR` at persistent storage
- Schedule `POST /api/cron/sla-check` with the `x-cron-secret` header

---

## Common problems

| Symptom | Cause | Fix |
|---|---|---|
| `AUTH_SECRET is missing or shorter than 32 characters` | Secret not set | `openssl rand -base64 48` into `.env` |
| `Environment variable not found: DATABASE_URL` | `.env` missing | `cp .env.example .env` |
| `Can't reach database server` | Postgres not running | `docker compose up -d db` |
| `type "vector" does not exist` | pgvector missing | Use the bundled image, or `CREATE EXTENSION vector;` |
| Port 5432 already in use | Another Postgres running | Stop it, or change the port in `docker-compose.yml` and `DATABASE_URL` |
| Port 3000 in use | Another dev server | `PORT=3001 npm run dev` |
| No OTP email | Brevo not configured | Check the server log for the `EMAIL (console transport)` block |
| Poor search results | Mixed embedding models | `npm run kb:reindex` |
| `Seed failed` on rerun | Partial previous run | `npm run db:reset` |

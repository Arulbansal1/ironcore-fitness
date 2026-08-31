# Deploying to Vercel

The app is Vercel-ready. This guide takes about 10 minutes.

You need two accounts, both free: **Vercel** and a hosted Postgres with
**pgvector** (Neon is recommended — Vercel's own Postgres integration is Neon
underneath).

---

## What had to change for Vercel

Four things about serverless hosting break a normally-fine Next.js app. All four
are already handled — this section is here so you know what was done and why.

| Problem | How it is solved |
|---|---|
| **No persistent disk.** Each request may run on a fresh machine, so an attachment written to `./uploads` is gone by the next request. | Attachment bytes are stored in Postgres when `VERCEL` is set (`src/lib/uploads.ts`). Override with `STORAGE_DRIVER=disk` when self-hosting with a mounted volume. |
| **No long-running processes.** `npm run sla:worker` cannot run on Vercel. | `vercel.json` registers a Vercel Cron that calls `/api/cron/sla-check`. The endpoint accepts Vercel's `Authorization: Bearer $CRON_SECRET` header and a `GET`, as well as the original `x-cron-secret` `POST`. |
| **Connection exhaustion.** Every lambda opening its own Postgres connection will exhaust the server. | The schema uses a pooled `DATABASE_URL` plus an unpooled `DIRECT_URL` for schema pushes, which cannot run through a transaction pooler. |
| **`output: 'standalone'`** is for self-hosting and confuses Vercel's build. | `next.config.mjs` disables it when `process.env.VERCEL` is set, so Docker and `npm start` still work locally. |

**Attachment storage trade-off:** keeping files in Postgres means one service to
deploy and nothing else to configure, at the cost of holding binaries in the
database. With the 10 MB cap and support-ticket volumes that is fine. A
high-traffic deployment should move to object storage (Vercel Blob or S3).

---

## 1. Create the database (Neon)

1. Sign up at <https://neon.tech> and create a project.
2. In the Neon SQL editor, enable the vector extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. From **Connection Details**, copy two strings:
   - the **Pooled** connection string → this becomes `DATABASE_URL`
   - the **Direct** connection string → this becomes `DIRECT_URL`

   Both look like `postgresql://user:pass@host/db?sslmode=require`. The pooled one
   contains `-pooler` in the hostname.

---

## 2. Push the code to GitHub

The repository is already initialised, committed, and pointed at
`https://github.com/Arulbansal1/ironcore-fitness`. You just need to authenticate
once and push:

```bash
gh auth login          # choose GitHub.com → HTTPS → login with a browser
gh repo create ironcore-fitness --private --source=. --push
```

`gh repo create` makes the repo and pushes in one step. If you would rather
create it on github.com by hand first, then just:

```bash
git push -u origin main
```

Use `--public` instead of `--private` if you want it visible — it is a portfolio
project, so public is a reasonable choice.

**Nothing sensitive is committed.** `.env`, `uploads/` and `.vercel/` are all
gitignored; only `.env.example` ships, and it contains placeholders.

---

## 2b. Your Vercel team

Your team (organisation) ID is:

```
team_UOID0ViyfsqkKhlCe9vSrHrZ
```

This is an **identifier, not a secret** — it is safe in config files and logs.
Vercel calls it `VERCEL_ORG_ID` when deploying from a script or CI.

You only need it for non-interactive deploys. Deploying through the Vercel
dashboard (the path below) picks the team automatically.

### Deploying from the terminal instead

The Vercel CLI is installed as a dev dependency, so `npx vercel` works here.

```bash
npx vercel login          # opens a browser once
npx vercel link --scope team_UOID0ViyfsqkKhlCe9vSrHrZ
npx vercel env pull       # brings the project's env vars into .env.local
npm run deploy            # vercel deploy --prod
```

Fully headless (CI, no browser) — create a token at
<https://vercel.com/account/tokens>, then:

```bash
export VERCEL_TOKEN="<your-token>"
export VERCEL_ORG_ID="team_UOID0ViyfsqkKhlCe9vSrHrZ"
export VERCEL_PROJECT_ID="<from Project → Settings → General>"
npx vercel deploy --prod --token "$VERCEL_TOKEN"
```

> A Vercel **token** *is* a secret — it can deploy and read env vars on your
> behalf. Never commit it or paste it into a chat. If one leaks, revoke it at
> <https://vercel.com/account/tokens>.

---

## 3. Import into Vercel

1. Go to <https://vercel.com/new> and import the repository.
2. Framework preset: **Next.js** (detected automatically).
3. **Do not deploy yet** — add the environment variables first (next step).

---

## 4. Environment variables

In **Project → Settings → Environment Variables**, add these for
**Production, Preview and Development**:

| Variable | Value | Required |
|---|---|---|
| `DATABASE_URL` | Neon **pooled** connection string | **Yes** |
| `DIRECT_URL` | Neon **direct** connection string | **Yes** |
| `AUTH_SECRET` | Run `openssl rand -base64 48` and paste the result | **Yes** |
| `CRON_SECRET` | Run `openssl rand -hex 32` and paste the result | **Yes** — Vercel Cron uses it |
| `NEXT_PUBLIC_APP_URL` | `https://your-project.vercel.app` | Recommended |
| `APP_DEV_SHOW_OTP` | `false` | **Yes in production** |
| `SEED_ADMIN_EMAILS` | Admin accounts, comma separated. Accepts `Name <email>` or a bare address. Defaults to `Arul Bansal <arulbansal1@gmail.com>,Priyanshu <priyanshura400na@gmail.com>` | Optional |
| `SEED_ADMIN_PASSWORD` | A strong password for your admin account | Recommended |
| `BREVO_API_KEY` | Brevo key, for real OTP emails | Optional |
| `BREVO_SENDER_EMAIL` | A sender address verified in Brevo | Optional |
| `OPENAI_API_KEY` | OpenAI key, for semantic AI | Optional |
| `SLACK_WEBHOOK_URL` | Slack incoming webhook | Optional |

> **`APP_DEV_SHOW_OTP=false` matters.** Left on, the API returns verification
> codes in its own responses — fine locally, a real account-takeover hole in
> production.

Without `BREVO_API_KEY`, OTP codes are only written to the server log — you would
have to read Vercel's function logs to sign a new member up. Set Brevo before
letting real people register.

---

## 5. Deploy

Click **Deploy**. The build runs `npm run vercel-build`, which:

1. **Preflight-checks the environment** — if `DATABASE_URL`, `DIRECT_URL` or
   `AUTH_SECRET` is missing or malformed, the build stops immediately with a
   message naming the variable, rather than failing later inside Prisma. It also
   refuses to build production with `APP_DEV_SHOW_OTP` enabled.
2. Generates the Prisma client
3. Pushes the schema to Neon
4. Builds Next.js

You can run the same check locally at any time:

```bash
npm run preflight
```

---

## 6. Seed the demo data

The build creates the tables but does not populate them. From your machine, with
the Neon URLs in your local `.env`:

```bash
DATABASE_URL="<neon-direct-url>" DIRECT_URL="<neon-direct-url>" npm run db:seed
```

Use the **direct** URL for seeding — it writes a lot of rows and pgvector data.

This creates your admin account(s), 4 staff, 6 members, the class timetable, 14
knowledge base articles with embeddings, and 12 demo tickets.

---

## 7. Verify

```bash
SMOKE_BASE_URL="https://your-project.vercel.app" npm run smoke
```

All 103 checks should pass against the live deployment.

Then sign in at `https://your-project.vercel.app/login`.

---

## Vercel Cron and the SLA sweep

`vercel.json` schedules `/api/cron/sla-check` **hourly** (`0 * * * *`).

**On the Hobby plan Vercel Cron runs at most once per day**, regardless of the
schedule. SLA breach detection will therefore be far less responsive than the
15-minute urgent target implies. Options:

- Upgrade to Pro for minute-level cron, or
- Point an external scheduler (cron-job.org, GitHub Actions) at
  `https://your-project.vercel.app/api/cron/sla-check` with the header
  `x-cron-secret: $CRON_SECRET`, or
- Trigger it manually from **Admin → SLA policies → Run breach sweep now**.

Safety escalations are unaffected: an injury or hazard report escalates the
moment the ticket is created, not on a timer.

---

## After deploying

- Sign in and **change your admin password** immediately if you did not set
  `SEED_ADMIN_PASSWORD`.
- Delete the demo `admin@ironcorefitness.example` account and any seeded members
  you do not want, from **Admin → Users & staff**.
- Set `BREVO_API_KEY` before real members sign up.
- If you add `OPENAI_API_KEY` later, run `npm run kb:reindex` against the
  production database — OpenAI and local embeddings are different vector spaces
  and mixing them degrades retrieval silently.

---

## Troubleshooting

**`type "vector" does not exist`** — you did not run
`CREATE EXTENSION IF NOT EXISTS vector;` in Neon. Run it, then redeploy.

**`Can't reach database server` during build** — `DIRECT_URL` is missing or
wrong. The schema push cannot go through the pooler.

**`Too many connections`** — `DATABASE_URL` is the direct string rather than the
pooled one. Swap it.

**Build fails on `prisma generate`** — make sure `postinstall` is present in
`package.json` (it is by default).

**Cron returns 401** — `CRON_SECRET` is not set in Vercel, or differs from the
value the scheduler sends.

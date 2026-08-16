/**
 * One-shot local setup check.
 *
 *   npm run setup
 *
 * Verifies the environment, confirms the database is reachable with pgvector
 * installed, and reports which optional integrations are active.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const check = (ok: boolean) => (ok ? '✓' : '✖');

async function main() {
  console.log('\n▸ Member Support Desk — setup check\n');

  let fatal = false;

  // --- .env -----------------------------------------------------------------
  const envPath = path.join(process.cwd(), '.env');
  const hasEnv = existsSync(envPath);
  console.log(`  ${check(hasEnv)} .env file ${hasEnv ? 'found' : 'MISSING — run: cp .env.example .env'}`);
  if (!hasEnv) fatal = true;

  // --- required vars --------------------------------------------------------
  const databaseUrl = process.env.DATABASE_URL;
  console.log(`  ${check(Boolean(databaseUrl))} DATABASE_URL ${databaseUrl ? 'set' : 'MISSING'}`);
  if (!databaseUrl) fatal = true;

  const directUrl = process.env.DIRECT_URL;
  console.log(
    `  ${check(Boolean(directUrl))} DIRECT_URL ${
      directUrl
        ? 'set'
        : 'MISSING — Prisma requires it. Locally set it to the same value as DATABASE_URL.'
    }`,
  );
  if (!directUrl) fatal = true;

  const authSecret = process.env.AUTH_SECRET ?? '';
  const authOk = authSecret.length >= 32;
  console.log(
    `  ${check(authOk)} AUTH_SECRET ${
      authOk ? 'set' : 'MISSING or too short (needs 32+ chars — openssl rand -base64 48)'
    }`,
  );
  if (!authOk) fatal = true;

  // --- database -------------------------------------------------------------
  console.log('');
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('  ✓ Database reachable');

    const extensions = await prisma.$queryRaw<Array<{ extname: string }>>`
      SELECT extname FROM pg_extension WHERE extname = 'vector'
    `;
    if (extensions.length > 0) {
      console.log('  ✓ pgvector extension installed');
    } else {
      console.log('  ✖ pgvector NOT installed — run: CREATE EXTENSION vector;');
      fatal = true;
    }

    const tables = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM information_schema.tables WHERE table_schema = 'public'
    `;
    const tableCount = Number(tables[0]?.count ?? 0);
    if (tableCount > 0) {
      const [users, tickets, articles, chunks] = await Promise.all([
        prisma.user.count(),
        prisma.ticket.count(),
        prisma.kbArticle.count(),
        prisma.kbChunk.count(),
      ]);
      console.log(`  ✓ Schema applied (${tableCount} tables)`);
      console.log(`    users: ${users} · tickets: ${tickets} · kb articles: ${articles} · vectors: ${chunks}`);
      if (users === 0) console.log('    → no data yet, run: npm run db:seed');
    } else {
      console.log('  ✖ No tables found — run: npm run db:push');
      fatal = true;
    }
  } catch (error) {
    console.log(`  ✖ Database unreachable: ${error instanceof Error ? error.message : error}`);
    console.log('    → start Postgres with: docker compose up -d db');
    fatal = true;
  }

  // --- optional integrations ------------------------------------------------
  console.log('\n  Optional integrations:');
  console.log(
    `    Email  ${process.env.BREVO_API_KEY ? '✓ Brevo API key set' : '· console fallback (OTP printed to server log)'}`,
  );
  console.log(
    `    AI     ${process.env.OPENAI_API_KEY ? '✓ OpenAI key set' : '· local engine (keyword triage + hashing embeddings)'}`,
  );
  console.log(
    `    Slack  ${process.env.SLACK_WEBHOOK_URL ? '✓ webhook set' : '· disabled (escalations stored in-app only)'}`,
  );

  console.log(
    fatal
      ? '\n✖ Setup incomplete — fix the items marked ✖ above.\n'
      : '\n✓ Everything checks out. Start the app with: npm run dev\n',
  );

  if (fatal) process.exit(1);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

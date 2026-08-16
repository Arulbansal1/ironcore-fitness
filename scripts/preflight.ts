/**
 * Build-time environment check.
 *
 * Runs before `prisma db push` in the Vercel build. Without it, a missing or
 * wrong database URL surfaces as a Prisma stack trace three steps later, which
 * is a miserable way to discover you forgot an environment variable.
 *
 * Exits non-zero with an actionable message instead.
 */

type Check = {
  name: string;
  value: string | undefined;
  required: boolean;
  hint: string;
  validate?: (value: string) => string | null;
};

const isVercel = Boolean(process.env.VERCEL);
const target = process.env.VERCEL_ENV ?? 'local';

const checks: Check[] = [
  {
    name: 'DATABASE_URL',
    value: process.env.DATABASE_URL,
    required: true,
    hint: 'Postgres connection string. On Vercel + Neon use the POOLED string (its host contains "-pooler").',
    validate: (v) =>
      v.startsWith('postgres://') || v.startsWith('postgresql://')
        ? null
        : 'must start with postgresql://',
  },
  {
    name: 'DIRECT_URL',
    value: process.env.DIRECT_URL,
    required: true,
    hint: 'Unpooled connection, used only for schema pushes. On Neon use the DIRECT string. Locally set it to the same value as DATABASE_URL.',
    validate: (v) =>
      v.startsWith('postgres://') || v.startsWith('postgresql://')
        ? null
        : 'must start with postgresql://',
  },
  {
    name: 'AUTH_SECRET',
    value: process.env.AUTH_SECRET,
    required: true,
    hint: 'Session signing key. Generate with: openssl rand -base64 48',
    validate: (v) => (v.length >= 32 ? null : 'must be at least 32 characters'),
  },
  {
    name: 'CRON_SECRET',
    value: process.env.CRON_SECRET,
    required: isVercel,
    hint: 'Shared secret for the SLA sweep endpoint. Vercel Cron sends it automatically. Generate with: openssl rand -hex 32',
  },
];

const problems: string[] = [];

for (const check of checks) {
  if (!check.value) {
    if (check.required) problems.push(`${check.name} is not set.\n      ${check.hint}`);
    continue;
  }
  const failure = check.validate?.(check.value);
  if (failure) problems.push(`${check.name} ${failure}.\n      ${check.hint}`);
}

// A production deployment that echoes OTP codes back in API responses is an
// account-takeover hole, so refuse to build one.
if (
  target === 'production' &&
  ['1', 'true', 'yes', 'on'].includes((process.env.APP_DEV_SHOW_OTP ?? '').toLowerCase())
) {
  problems.push(
    'APP_DEV_SHOW_OTP is enabled in production.\n' +
      '      This returns email verification codes in API responses — anyone could take over an account.\n' +
      '      Set APP_DEV_SHOW_OTP=false.',
  );
}

if (problems.length > 0) {
  console.error(`\n✖ Cannot build for "${target}" — fix these first:\n`);
  problems.forEach((p, i) => console.error(`  ${i + 1}. ${p}\n`));
  console.error('  Set them in Vercel: Project → Settings → Environment Variables.');
  console.error('  Full walkthrough: DEPLOY.md\n');
  process.exit(1);
}

const optional = [
  ['BREVO_API_KEY', 'real OTP emails', 'codes only appear in the server log'],
  ['OPENAI_API_KEY', 'semantic AI triage & embeddings', 'local keyword engine is used'],
  ['SLACK_WEBHOOK_URL', 'Slack breach alerts', 'escalations stay in-app'],
] as const;

console.log(`\n▸ Preflight OK for "${target}"`);
for (const [name, purpose, fallback] of optional) {
  console.log(
    process.env[name] ? `  ✓ ${name} set — ${purpose}` : `  · ${name} not set — ${fallback}`,
  );
}
console.log('');

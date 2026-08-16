/**
 * Central environment access. Everything is read lazily so that a missing
 * optional key never crashes the app at import time — features degrade to a
 * documented local fallback instead.
 */

function str(key: string, fallback = ''): string {
  const v = process.env[key];
  return v === undefined || v === null || v === '' ? fallback : v;
}

function num(key: string, fallback: number): number {
  const v = Number(process.env[key]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function bool(key: string, fallback = false): boolean {
  const v = process.env[key];
  if (v === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

export const env = {
  get databaseUrl() {
    return str('DATABASE_URL');
  },
  get authSecret() {
    const secret = str('AUTH_SECRET');
    if (!secret || secret.length < 32) {
      // Fail loudly: signing sessions with a weak/absent secret is unsafe.
      throw new Error(
        'AUTH_SECRET is missing or shorter than 32 characters. Copy .env.example to .env and set it (openssl rand -base64 48).',
      );
    }
    return secret;
  },
  get sessionDays() {
    return num('AUTH_SESSION_DAYS', 7);
  },
  get appUrl() {
    return str('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
  },

  // Brevo
  get brevoApiKey() {
    return str('BREVO_API_KEY');
  },
  get brevoSenderEmail() {
    return str('BREVO_SENDER_EMAIL', 'no-reply@support-desk.local');
  },
  get brevoSenderName() {
    return str('BREVO_SENDER_NAME', 'Support Desk');
  },
  get showOtpInResponse() {
    return bool('APP_DEV_SHOW_OTP', process.env.NODE_ENV !== 'production');
  },

  // OpenAI
  get openaiApiKey() {
    return str('OPENAI_API_KEY');
  },
  get openaiChatModel() {
    return str('OPENAI_CHAT_MODEL', 'gpt-4o-mini');
  },
  get openaiEmbeddingModel() {
    return str('OPENAI_EMBEDDING_MODEL', 'text-embedding-3-small');
  },

  // Slack
  get slackWebhookUrl() {
    return str('SLACK_WEBHOOK_URL');
  },
  get slackChannel() {
    return str('SLACK_ALERT_CHANNEL', '#support-alerts');
  },

  // Cron / worker
  get cronSecret() {
    return str('CRON_SECRET', 'local-dev-cron-secret');
  },
  get slaWorkerIntervalSeconds() {
    return num('SLA_WORKER_INTERVAL_SECONDS', 60);
  },

  // Uploads
  get uploadDir() {
    return str('UPLOAD_DIR', './uploads');
  },
  get maxUploadBytes() {
    return num('MAX_UPLOAD_MB', 10) * 1024 * 1024;
  },

  get isProduction() {
    return process.env.NODE_ENV === 'production';
  },
};

/** Feature availability, surfaced in the admin "System health" panel. */
export function integrationStatus() {
  return {
    email: env.brevoApiKey ? 'brevo' : 'console',
    ai: env.openaiApiKey ? 'openai' : 'local',
    slack: env.slackWebhookUrl ? 'webhook' : 'disabled',
  } as const;
}

export const EMBEDDING_DIMENSIONS = 1536;

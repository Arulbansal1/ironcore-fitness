import 'server-only';

import { env } from './env';

export type SlackResult = { sent: boolean; error?: string };

type AlertArgs = {
  title: string;
  severity: 'warning' | 'critical' | 'info';
  ticketNumber: number;
  ticketSubject: string;
  ticketId: string;
  fields: Array<{ label: string; value: string }>;
  detail: string;
};

const SEVERITY_EMOJI = {
  info: ':information_source:',
  warning: ':warning:',
  critical: ':rotating_light:',
} as const;

/**
 * Posts an SLA / escalation alert to a Slack Incoming Webhook.
 * With no SLACK_WEBHOOK_URL configured this is a no-op that reports
 * `sent: false` — the escalation is still persisted and shown in the app.
 */
export async function sendSlackAlert(args: AlertArgs): Promise<SlackResult> {
  const ticketUrl = `${env.appUrl}/staff/tickets/${args.ticketId}`;

  if (!env.slackWebhookUrl) {
    console.info(
      `[slack:disabled] ${SEVERITY_EMOJI[args.severity]} ${args.title} — #${args.ticketNumber} ${args.ticketSubject} (${ticketUrl})`,
    );
    return { sent: false, error: 'SLACK_WEBHOOK_URL not configured' };
  }

  const payload = {
    channel: env.slackChannel,
    text: `${SEVERITY_EMOJI[args.severity]} ${args.title} — #${args.ticketNumber} ${args.ticketSubject}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${SEVERITY_EMOJI[args.severity]} ${args.title}`.slice(0, 150),
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*<${ticketUrl}|#${args.ticketNumber} — ${args.ticketSubject}>*\n${args.detail}`,
        },
      },
      {
        type: 'section',
        fields: args.fields.slice(0, 10).map((f) => ({
          type: 'mrkdwn',
          text: `*${f.label}*\n${f.value}`,
        })),
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Open ticket', emoji: true },
            url: ticketUrl,
            style: args.severity === 'critical' ? 'danger' : 'primary',
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Member Support Desk · automated SLA monitor',
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(env.slackWebhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('[slack] webhook failed', response.status, body);
      return { sent: false, error: `Slack responded ${response.status}: ${body.slice(0, 120)}` };
    }
    return { sent: true };
  } catch (error) {
    console.error('[slack] webhook error', error);
    return { sent: false, error: error instanceof Error ? error.message : 'Unknown Slack error' };
  }
}

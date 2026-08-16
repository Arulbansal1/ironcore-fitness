import 'server-only';

import { env } from './env';

export type EmailResult = {
  delivered: boolean;
  transport: 'brevo' | 'console';
  messageId?: string;
  error?: string;
};

type SendArgs = {
  to: { email: string; name?: string };
  subject: string;
  html: string;
  text: string;
};

/**
 * Sends a transactional email through Brevo's REST API.
 * When BREVO_API_KEY is not configured the message is written to the server log
 * instead, so local demos can complete the OTP flow without an email provider.
 */
export async function sendEmail({ to, subject, html, text }: SendArgs): Promise<EmailResult> {
  if (!env.brevoApiKey) {
    console.info(
      [
        '',
        '─────────────────────────────────────────────────────────────',
        ' EMAIL (console transport — BREVO_API_KEY not set)',
        ` To:      ${to.email}`,
        ` Subject: ${subject}`,
        '',
        text,
        '─────────────────────────────────────────────────────────────',
        '',
      ].join('\n'),
    );
    return { delivered: true, transport: 'console' };
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': env.brevoApiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: env.brevoSenderEmail, name: env.brevoSenderName },
        to: [{ email: to.email, name: to.name }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
      // Do not let a slow provider hang a signup request.
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('[brevo] send failed', response.status, body);
      return {
        delivered: false,
        transport: 'brevo',
        error: `Brevo responded ${response.status}`,
      };
    }

    const data = (await response.json()) as { messageId?: string };
    return { delivered: true, transport: 'brevo', messageId: data.messageId };
  } catch (error) {
    console.error('[brevo] send error', error);
    return {
      delivered: false,
      transport: 'brevo',
      error: error instanceof Error ? error.message : 'Unknown Brevo error',
    };
  }
}

// --- templates -------------------------------------------------------------

function layout(title: string, bodyHtml: string) {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f1f5f9;padding:32px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 32px -16px rgba(15,23,42,.28)">
          <tr><td style="background:#4f46e5;padding:20px 28px;color:#fff;font-size:16px;font-weight:600">Support Desk</td></tr>
          <tr><td style="padding:28px">
            <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${title}</h1>
            ${bodyHtml}
          </td></tr>
          <tr><td style="padding:16px 28px;background:#f8fafc;color:#64748b;font-size:12px">
            You are receiving this because an account was created on Support Desk with this address.
            If it wasn't you, you can safely ignore this email.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function otpBlock(code: string) {
  return `<p style="margin:0 0 18px;color:#475569;font-size:14px">Enter this 6-digit code to continue:</p>
  <div style="font-size:34px;letter-spacing:12px;font-weight:700;background:#eef2ff;color:#3730a3;padding:18px;border-radius:12px;text-align:center;margin-bottom:18px">${code}</div>
  <p style="margin:0;color:#64748b;font-size:13px">This code expires in 10 minutes and can only be used once.</p>`;
}

export function verificationEmail(name: string, code: string) {
  return {
    subject: `${code} is your Support Desk verification code`,
    html: layout(`Welcome, ${escapeHtml(name)} 👋`, otpBlock(code)),
    text: `Welcome to Support Desk, ${name}.\n\nYour email verification code is: ${code}\n\nIt expires in 10 minutes.`,
  };
}

export function passwordResetEmail(name: string, code: string) {
  return {
    subject: `${code} is your Support Desk password reset code`,
    html: layout(
      'Reset your password',
      `<p style="margin:0 0 18px;color:#475569;font-size:14px">Hi ${escapeHtml(
        name,
      )}, we received a request to reset your password.</p>${otpBlock(code)}`,
    ),
    text: `Hi ${name},\n\nYour password reset code is: ${code}\n\nIt expires in 10 minutes. If you didn't request this, ignore this email.`,
  };
}

export function ticketReplyEmail(name: string, ticketNumber: number, subject: string, preview: string) {
  const url = `${env.appUrl}/member/tickets`;
  return {
    subject: `Re: [#${ticketNumber}] ${subject}`,
    html: layout(
      `New reply on ticket #${ticketNumber}`,
      `<p style="margin:0 0 12px;color:#475569;font-size:14px">Hi ${escapeHtml(
        name,
      )}, a staff replied to your ticket.</p>
       <blockquote style="margin:0 0 18px;padding:12px 16px;background:#f8fafc;border-left:3px solid #4f46e5;color:#334155;font-size:14px">${escapeHtml(
         preview,
       )}</blockquote>
       <a href="${url}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:11px 20px;border-radius:10px;font-size:14px;font-weight:600">View ticket</a>`,
    ),
    text: `Hi ${name},\n\nA staff replied to ticket #${ticketNumber} (${subject}):\n\n${preview}\n\nView it at ${url}`,
  };
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

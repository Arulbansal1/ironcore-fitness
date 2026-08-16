'use client';

import { Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { OtpInput } from '@/components/auth/OtpInput';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Feedback';
import { apiFetch, errorMessage } from '@/lib/api-client';

type VerifyResponse = {
  message: string;
  redirectTo: string;
  alreadyVerified?: boolean;
};

type ResendResponse = { message: string; devCode?: string; transport?: string };

const RESEND_SECONDS = 60;

export function VerifyEmailForm({
  initialEmail,
  devCode,
}: {
  initialEmail: string;
  devCode?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [devHint, setDevHint] = useState<string | undefined>(devCode);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(initialEmail ? RESEND_SECONDS : 0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const submit = useCallback(
    async (submittedCode: string) => {
      if (!email.trim()) {
        setError('Enter the email address you signed up with.');
        return;
      }
      if (submittedCode.length !== 6) {
        setError('Enter all 6 digits.');
        return;
      }

      setError(null);
      setSubmitting(true);
      try {
        const result = await apiFetch<VerifyResponse>('/api/auth/verify-otp', {
          method: 'POST',
          body: { email: email.trim(), code: submittedCode },
        });
        router.push(result.redirectTo);
        router.refresh();
      } catch (caught) {
        setError(errorMessage(caught, 'Could not verify that code.'));
        setCode('');
        setSubmitting(false);
      }
    },
    [email, router],
  );

  async function handleResend() {
    setError(null);
    setNotice(null);
    setResending(true);
    try {
      const result = await apiFetch<ResendResponse>('/api/auth/resend-otp', {
        method: 'POST',
        body: { email: email.trim(), purpose: 'EMAIL_VERIFICATION' },
      });
      setNotice(result.message);
      setDevHint(result.devCode);
      setCode('');
      setCooldown(RESEND_SECONDS);
    } catch (caught) {
      setError(errorMessage(caught, 'Could not send a new code.'));
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="space-y-5">
      {devHint && (
        <Alert tone="info" title="Development mode">
          Email delivery is not configured, so here is your code:{' '}
          <strong className="font-mono tracking-widest">{devHint}</strong>
          <span className="mt-1 block text-xs opacity-80">
            Set <code>BREVO_API_KEY</code> in <code>.env</code> to send real emails, and{' '}
            <code>APP_DEV_SHOW_OTP=false</code> to hide this.
          </span>
        </Alert>
      )}

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {!initialEmail && (
        <Input
          label="Email"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          leading={<Mail className="h-4 w-4" aria-hidden />}
        />
      )}

      <div className="space-y-2">
        <span className="block text-sm font-medium text-ink">Verification code</span>
        <OtpInput
          value={code}
          onChange={setCode}
          onComplete={submit}
          disabled={submitting}
          error={Boolean(error)}
        />
      </div>

      <Button
        type="button"
        fullWidth
        size="lg"
        loading={submitting}
        onClick={() => submit(code)}
        disabled={code.length !== 6}
      >
        {submitting ? 'Verifying…' : 'Verify email'}
      </Button>

      <div className="text-center text-sm text-muted">
        Didn&apos;t get it?{' '}
        {cooldown > 0 ? (
          <span>Resend available in {cooldown}s</span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="font-medium text-brand-600 hover:underline disabled:opacity-60"
          >
            {resending ? 'Sending…' : 'Send a new code'}
          </button>
        )}
      </div>
    </div>
  );
}

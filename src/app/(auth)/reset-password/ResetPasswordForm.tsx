'use client';

import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { OtpInput } from '@/components/auth/OtpInput';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Feedback';
import { apiFetch, errorMessage } from '@/lib/api-client';

type ResetResponse = { message: string; redirectTo: string };
type ResendResponse = { message: string; devCode?: string };

const RESEND_SECONDS = 60;

export function ResetPasswordForm({
  initialEmail,
  devCode,
}: {
  initialEmail: string;
  devCode?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [devHint, setDevHint] = useState(devCode);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(initialEmail ? RESEND_SECONDS : 0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!email.trim()) return setError('Enter your email address.');
    if (code.length !== 6) return setError('Enter all 6 digits of your reset code.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return setError('Password must include at least one letter and one number.');
    }

    setSubmitting(true);
    try {
      await apiFetch<ResetResponse>('/api/auth/reset-password', {
        method: 'POST',
        body: { email: email.trim(), code, password },
      });
      router.push('/login?reset=1');
    } catch (caught) {
      setError(errorMessage(caught, 'Could not reset your password.'));
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setError(null);
    setNotice(null);
    try {
      const result = await apiFetch<ResendResponse>('/api/auth/resend-otp', {
        method: 'POST',
        body: { email: email.trim(), purpose: 'PASSWORD_RESET' },
      });
      setNotice(result.message);
      setDevHint(result.devCode);
      setCode('');
      setCooldown(RESEND_SECONDS);
    } catch (caught) {
      setError(errorMessage(caught, 'Could not send a new code.'));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {devHint && (
        <Alert tone="info" title="Development mode">
          Your reset code: <strong className="font-mono tracking-widest">{devHint}</strong>
        </Alert>
      )}
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {!initialEmail && (
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          leading={<Mail className="h-4 w-4" aria-hidden />}
          required
        />
      )}

      <div className="space-y-2">
        <span className="block text-sm font-medium text-ink">Reset code</span>
        <OtpInput value={code} onChange={setCode} disabled={submitting} error={Boolean(error)} />
      </div>

      <Input
        label="New password"
        type={showPassword ? 'text' : 'password'}
        placeholder="At least 8 characters"
        autoComplete="new-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        hint="Must include a letter and a number, and differ from your old password."
        leading={<Lock className="h-4 w-4" aria-hidden />}
        trailing={
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="rounded p-1 transition-colors hover:text-ink"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
        }
      />

      <Button type="submit" fullWidth size="lg" loading={submitting}>
        {submitting ? 'Updating…' : 'Reset password'}
      </Button>

      <div className="text-center text-sm text-muted">
        {cooldown > 0 ? (
          <span>Resend available in {cooldown}s</span>
        ) : (
          <button type="button" onClick={handleResend} className="font-medium text-brand-600 hover:underline">
            Send a new code
          </button>
        )}
      </div>
    </form>
  );
}

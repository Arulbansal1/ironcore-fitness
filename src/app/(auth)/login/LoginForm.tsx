'use client';

import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Feedback';
import { ApiClientError, apiFetch, errorMessage } from '@/lib/api-client';

type LoginResponse = {
  message: string;
  user: { id: string; name: string; email: string; role: string };
  redirectTo: string;
};

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@supportdesk.example' },
  { label: 'Staff', email: 'maya.chen@supportdesk.example' },
  { label: 'Member', email: 'priya.raman@example.com' },
];

export function LoginForm({ nextPath, justReset }: { nextPath?: string; justReset?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!email.trim() || !password) {
      setFormError('Enter your email and password.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await apiFetch<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: { email: email.trim(), password },
      });

      const destination = nextPath?.startsWith('/') ? nextPath : result.redirectTo;
      router.push(destination);
      router.refresh();
    } catch (error) {
      // An unverified account is redirected to verification rather than dead-ended.
      if (error instanceof ApiClientError && error.code === 'email_unverified') {
        router.push(`/verify-email?email=${encodeURIComponent(email.trim())}`);
        return;
      }
      setFormError(errorMessage(error, 'Could not sign you in.'));
      setSubmitting(false);
    }
  }

  function useDemoAccount(demoEmail: string) {
    setEmail(demoEmail);
    setPassword('Password123');
    setFormError(null);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {justReset && (
        <Alert tone="success">Password updated. Sign in with your new password.</Alert>
      )}
      {formError && <Alert tone="error">{formError}</Alert>}

      <Input
        label="Email"
        type="email"
        placeholder="you@company.com"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        leading={<Mail className="h-4 w-4" aria-hidden />}
      />

      <div>
        <Input
          label="Password"
          type={showPassword ? 'text' : 'password'}
          placeholder="Your password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
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
        <div className="mt-1.5 text-right">
          <Link href="/forgot-password" className="text-xs font-medium text-brand-600 hover:underline">
            Forgot password?
          </Link>
        </div>
      </div>

      <Button type="submit" fullWidth size="lg" loading={submitting}>
        {submitting ? 'Signing in…' : 'Sign in'}
      </Button>

      <div className="rounded-lg border border-dashed border-line bg-surface-2/60 p-3">
        <p className="text-xs font-medium text-ink">Demo accounts</p>
        <p className="mt-0.5 text-xs text-muted">
          Seeded logins, password <code className="font-mono text-[11px]">Password123</code>
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => useDemoAccount(account.email)}
              className="rounded-md border border-line bg-surface px-2 py-1 text-xs font-medium text-ink transition-colors hover:border-brand-500 hover:text-brand-600"
            >
              {account.label}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}

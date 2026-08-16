'use client';

import { Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Feedback';
import { apiFetch, errorMessage } from '@/lib/api-client';

type ForgotResponse = { message: string; email: string; devCode?: string };

export function ForgotPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await apiFetch<ForgotResponse>('/api/auth/forgot-password', {
        method: 'POST',
        body: { email: email.trim() },
      });

      const params = new URLSearchParams({ email: result.email });
      if (result.devCode) params.set('dev', result.devCode);
      router.push(`/reset-password?${params.toString()}`);
    } catch (caught) {
      setError(errorMessage(caught, 'Could not send a reset code.'));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && <Alert tone="error">{error}</Alert>}

      <Input
        label="Email"
        type="email"
        placeholder="you@company.com"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        leading={<Mail className="h-4 w-4" aria-hidden />}
        hint="If an account exists we'll email a code. It expires in 10 minutes."
      />

      <Button type="submit" fullWidth size="lg" loading={submitting}>
        {submitting ? 'Sending code…' : 'Send reset code'}
      </Button>
    </form>
  );
}

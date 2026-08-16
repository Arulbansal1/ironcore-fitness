'use client';

import { Building2, Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Feedback';
import { apiFetch, errorMessage } from '@/lib/api-client';

type SignupResponse = {
  message: string;
  email: string;
  transport: 'brevo' | 'console';
  deliveryFailed: boolean;
  devCode?: string;
};

export function SignupForm() {
  const router = useRouter();
  const [values, setValues] = useState({ name: '', email: '', password: '', company: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setValues((current) => ({ ...current, [key]: event.target.value }));
    setFieldErrors((current) => ({ ...current, [key]: '' }));
  };

  function validate() {
    const errors: Record<string, string> = {};
    if (values.name.trim().length < 2) errors.name = 'Please enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = 'Enter a valid email address.';
    if (values.password.length < 8) errors.password = 'Password must be at least 8 characters.';
    else if (!/[a-zA-Z]/.test(values.password) || !/[0-9]/.test(values.password)) {
      errors.password = 'Include at least one letter and one number.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const result = await apiFetch<SignupResponse>('/api/auth/signup', {
        method: 'POST',
        body: {
          name: values.name.trim(),
          email: values.email.trim(),
          password: values.password,
          company: values.company.trim(),
        },
      });

      const params = new URLSearchParams({ email: result.email });
      if (result.devCode) params.set('dev', result.devCode);
      router.push(`/verify-email?${params.toString()}`);
    } catch (error) {
      setFormError(errorMessage(error, 'Could not create your account.'));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {formError && <Alert tone="error">{formError}</Alert>}

      <Input
        label="Full name"
        placeholder="Priya Raman"
        autoComplete="name"
        required
        value={values.name}
        onChange={update('name')}
        error={fieldErrors.name}
        leading={<User className="h-4 w-4" aria-hidden />}
      />

      <Input
        label="Work email"
        type="email"
        placeholder="you@company.com"
        autoComplete="email"
        required
        value={values.email}
        onChange={update('email')}
        error={fieldErrors.email}
        leading={<Mail className="h-4 w-4" aria-hidden />}
      />

      <Input
        label="Company"
        placeholder="Optional"
        autoComplete="organization"
        value={values.company}
        onChange={update('company')}
        leading={<Building2 className="h-4 w-4" aria-hidden />}
      />

      <Input
        label="Password"
        type={showPassword ? 'text' : 'password'}
        placeholder="At least 8 characters"
        autoComplete="new-password"
        required
        value={values.password}
        onChange={update('password')}
        error={fieldErrors.password}
        hint="Must include a letter and a number."
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
        {submitting ? 'Creating account…' : 'Create account'}
      </Button>

      <p className="text-center text-xs text-muted">
        We&apos;ll email you a 6-digit code to verify your address.
      </p>
    </form>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthShell } from '@/components/auth/AuthShell';

import { ResetPasswordForm } from './ResetPasswordForm';

export const metadata: Metadata = { title: 'Set a new password' };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; dev?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthShell
      title="Set a new password"
      subtitle={
        params.email
          ? `Enter the code we sent to ${params.email} and choose a new password.`
          : 'Enter your reset code and choose a new password.'
      }
      footer={
        <>
          Need a new code?{' '}
          <Link href="/forgot-password" className="font-medium text-brand-600 hover:underline">
            Request another
          </Link>
        </>
      }
    >
      <ResetPasswordForm initialEmail={params.email ?? ''} devCode={params.dev} />
    </AuthShell>
  );
}

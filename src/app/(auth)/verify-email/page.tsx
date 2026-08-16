import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthShell } from '@/components/auth/AuthShell';

import { VerifyEmailForm } from './VerifyEmailForm';

export const metadata: Metadata = { title: 'Verify your email' };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; dev?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthShell
      title="Check your email"
      subtitle={
        params.email
          ? `We sent a 6-digit code to ${params.email}.`
          : 'Enter the 6-digit code we emailed you.'
      }
      footer={
        <>
          Wrong address?{' '}
          <Link href="/signup" className="font-medium text-brand-600 hover:underline">
            Start over
          </Link>
        </>
      }
    >
      <VerifyEmailForm initialEmail={params.email ?? ''} devCode={params.dev} />
    </AuthShell>
  );
}

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/layout/AppShell';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

import { BillingClient } from './BillingClient';

export const metadata: Metadata = { title: 'Billing (demo)' };
export const dynamic = 'force-dynamic';

export default async function BillingPage() {
  const user = await getSession();
  if (!user) redirect('/login');

  const payments = await prisma.payment.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });

  return (
    <>
      <PageHeader
        title="Billing"
        description="Simulated checkout for the showcase — no payment processor is contacted."
      />

      <BillingClient
        initialPayments={payments.map((payment) => ({
          ...payment,
          createdAt: payment.createdAt.toISOString(),
        }))}
      />
    </>
  );
}

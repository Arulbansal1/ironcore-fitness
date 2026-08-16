import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/AppShell';
import { env, integrationStatus } from '@/lib/env';
import { prisma } from '@/lib/prisma';

import { SlaManager } from './SlaManager';

export const metadata: Metadata = { title: 'SLA policies' };
export const dynamic = 'force-dynamic';

export default async function AdminSlaPage() {
  const [policies, breachCount] = await Promise.all([
    prisma.slaPolicy.findMany({
      orderBy: { priority: 'desc' },
      include: { _count: { select: { tickets: true } } },
    }),
    prisma.escalation.count({ where: { status: 'OPEN' } }),
  ]);

  return (
    <>
      <PageHeader
        title="SLA policies"
        description="Response and resolution targets per priority, and how breaches escalate."
      />

      <SlaManager
        policies={policies.map((policy) => ({
          id: policy.id,
          name: policy.name,
          priority: policy.priority,
          firstResponseMins: policy.firstResponseMins,
          resolutionMins: policy.resolutionMins,
          escalateAfterMins: policy.escalateAfterMins,
          notifySlack: policy.notifySlack,
          isActive: policy.isActive,
          ticketCount: policy._count.tickets,
        }))}
        openEscalations={breachCount}
        slackConfigured={integrationStatus().slack === 'webhook'}
        cronIntervalSeconds={env.slaWorkerIntervalSeconds}
      />
    </>
  );
}

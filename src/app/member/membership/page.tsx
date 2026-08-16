import { CalendarDays, CreditCard, Dumbbell, Snowflake, TriangleAlert } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, EmptyState } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import { getSession } from '@/lib/auth';
import { DEMO_PLANS } from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import { formatCurrency, formatDate, relativeTime, titleCase } from '@/lib/utils';

export const metadata: Metadata = { title: 'My membership' };
export const dynamic = 'force-dynamic';

const TIER_TONE: Record<string, 'neutral' | 'brand' | 'purple'> = {
  DAY_PASS: 'neutral',
  BASIC: 'neutral',
  PRO: 'brand',
  ELITE: 'purple',
};

const STATUS_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  ACTIVE: 'success',
  FROZEN: 'info',
  PENDING: 'warning',
  EXPIRED: 'danger',
  CANCELLED: 'neutral',
};

export default async function MembershipPage() {
  const user = await getSession();
  if (!user) redirect('/login');

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [profile, visitsThisMonth, totalVisits, lastVisit, recentVisits, payments] =
    await Promise.all([
      prisma.memberProfile.findUnique({ where: { userId: user.id } }),
      prisma.checkIn.count({ where: { memberId: user.id, at: { gte: monthStart } } }),
      prisma.checkIn.count({ where: { memberId: user.id } }),
      prisma.checkIn.findFirst({
        where: { memberId: user.id },
        orderBy: { at: 'desc' },
        select: { at: true },
      }),
      prisma.checkIn.findMany({
        where: { memberId: user.id },
        orderBy: { at: 'desc' },
        take: 10,
        select: { id: true, at: true, source: true },
      }),
      prisma.payment.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

  const plan = profile ? DEMO_PLANS.find((p) => p.id === profile.tier) : undefined;
  const expiringSoon =
    profile?.expiresAt && new Date(profile.expiresAt).getTime() - Date.now() < 30 * 86_400_000;

  return (
    <>
      <PageHeader
        title="My membership"
        description="Your plan, your access, and how often you've been training."
        action={
          <Link href="/member/billing">
            <Button variant="outline">
              <CreditCard className="h-4 w-4" aria-hidden />
              Billing
            </Button>
          </Link>
        }
      />

      {!profile ? (
        <Card>
          <EmptyState
            icon={<Dumbbell className="h-5 w-5" />}
            title="No membership on file"
            description="Your account exists but no membership has been set up yet. Open a ticket and the front desk will sort it."
            action={
              <Link href="/member/tickets/new">
                <Button size="sm">Contact the front desk</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Your plan"
              value={titleCase(profile.tier)}
              hint={plan ? `${formatCurrency(plan.amountCents)}/month` : undefined}
              icon={<Dumbbell className="h-4 w-4" />}
              tone="brand"
            />
            <StatTile
              label="Status"
              value={titleCase(profile.status)}
              hint={
                profile.status === 'FROZEN' && profile.frozenUntil
                  ? `Resumes ${formatDate(profile.frozenUntil)}`
                  : profile.expiresAt
                    ? `Renews ${formatDate(profile.expiresAt)}`
                    : undefined
              }
              tone={
                profile.status === 'ACTIVE'
                  ? 'success'
                  : profile.status === 'FROZEN'
                    ? 'warning'
                    : 'danger'
              }
            />
            <StatTile
              label="Visits this month"
              value={visitsThisMonth}
              hint={`${totalVisits} all time`}
              icon={<CalendarDays className="h-4 w-4" />}
            />
            <StatTile
              label="Last visit"
              value={lastVisit ? relativeTime(lastVisit.at) : '—'}
              hint={lastVisit ? formatDate(lastVisit.at) : 'No check-ins recorded'}
            />
          </div>

          {profile.status === 'FROZEN' && (
            <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200">
              <Snowflake className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div>
                <p className="font-medium">Your membership is frozen</p>
                <p className="mt-0.5">
                  {profile.freezeReason ?? 'On hold at your request'}
                  {profile.frozenUntil ? ` — resuming ${formatDate(profile.frozenUntil)}.` : '.'} You
                  are billed the $5 holding fee, not your normal rate, and your key fob is inactive
                  until the freeze ends.
                </p>
              </div>
            </div>
          )}

          {(profile.status === 'EXPIRED' || profile.status === 'CANCELLED') && (
            <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div>
                <p className="font-medium">
                  Your membership is {profile.status.toLowerCase()}
                </p>
                <p className="mt-0.5">
                  Your key fob will not open the turnstile. Restart your membership from the billing
                  page, or open a ticket and we will help.
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Membership details" />
              <CardBody className="space-y-3 text-sm">
                <Row label="Member number" value={profile.memberNumber} mono />
                <Row label="Plan" value={<Badge tone={TIER_TONE[profile.tier] ?? 'neutral'}>{titleCase(profile.tier)}</Badge>} />
                <Row
                  label="Status"
                  value={
                    <Badge tone={STATUS_TONE[profile.status] ?? 'neutral'} dot>
                      {titleCase(profile.status)}
                    </Badge>
                  }
                />
                <Row label="Member since" value={formatDate(profile.joinedAt)} />
                <Row
                  label="Renews"
                  value={
                    profile.expiresAt ? (
                      <span className={expiringSoon ? 'font-medium text-amber-600 dark:text-amber-400' : ''}>
                        {formatDate(profile.expiresAt)}
                      </span>
                    ) : (
                      '—'
                    )
                  }
                />
                <Row label="Home gym" value={profile.homeBranch} />
                {profile.goals && <Row label="Your goals" value={profile.goals} />}
                {profile.emergencyContactName && (
                  <Row
                    label="Emergency contact"
                    value={`${profile.emergencyContactName}${profile.emergencyContactPhone ? ` · ${profile.emergencyContactPhone}` : ''}`}
                  />
                )}
              </CardBody>
            </Card>

            <div className="space-y-4">
              {plan && (
                <Card>
                  <CardHeader title={`What ${titleCase(profile.tier)} includes`} />
                  <CardBody>
                    <ul className="space-y-2">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex gap-2 text-sm text-muted">
                          <span
                            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500"
                            aria-hidden
                          />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </CardBody>
                </Card>
              )}

              <Card>
                <CardHeader title="Need to change something?" />
                <CardBody className="space-y-2">
                  <p className="text-sm leading-relaxed text-muted">
                    Freezes, cancellations, plan changes and billing questions all go through the
                    front desk so there is a written record.
                  </p>
                  <Link href="/member/tickets/new">
                    <Button fullWidth variant="outline">
                      Open a membership ticket
                    </Button>
                  </Link>
                </CardBody>
              </Card>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Recent visits" description="Check-ins at the turnstile" />
              {recentVisits.length === 0 ? (
                <EmptyState title="No visits recorded yet" description="Your check-ins will appear here." />
              ) : (
                <ul className="divide-y divide-line">
                  {recentVisits.map((visit) => (
                    <li
                      key={visit.id}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5"
                    >
                      <span className="text-ink">{formatDate(visit.at)}</span>
                      <span className="text-xs text-muted">
                        {new Date(visit.at).toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        · {titleCase(visit.source)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader
                title="Recent payments"
                description="DEMO PAYMENT — NO REAL MONEY"
                icon={<CreditCard className="h-4 w-4" />}
              />
              {payments.length === 0 ? (
                <EmptyState title="No payments yet" description="Simulated transactions appear here." />
              ) : (
                <ul className="divide-y divide-line">
                  {payments.map((payment) => (
                    <li
                      key={payment.id}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5"
                    >
                      <span className="min-w-0">
                        <span className="block text-ink">
                          {titleCase(payment.plan)} · {formatCurrency(payment.amountCents, payment.currency)}
                        </span>
                        <span className="block text-xs text-muted">
                          {formatDate(payment.createdAt)} · {payment.cardBrand} ••{payment.cardLast4}
                        </span>
                      </span>
                      <Badge tone={payment.status === 'SUCCEEDED' ? 'success' : 'danger'}>
                        {payment.status === 'SUCCEEDED' ? 'Paid' : 'Failed'}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-xs text-muted">{label}</span>
      <span className={`min-w-0 text-right text-sm text-ink ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
    </div>
  );
}

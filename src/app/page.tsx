import {
  ArrowRight,
  BarChart3,
  Bot,
  BookOpen,
  CalendarDays,
  Dumbbell,
  Gauge,
  HeartPulse,
  MessagesSquare,
  ShieldCheck,
  Slack,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';

import { getSession, homeForRole } from '@/lib/auth';
import { integrationStatus } from '@/lib/env';

const FEATURES = [
  {
    icon: HeartPulse,
    title: 'Safety is never queued',
    body: 'Any message mentioning an injury, pain or a hazard is detected on arrival, forced to urgent, and escalated to the duty manager before an SLA timer ever runs.',
  },
  {
    icon: Bot,
    title: 'Triage on arrival',
    body: 'Category, priority, sentiment and a summary are set the second a member writes in — with a confidence score the team can audit.',
  },
  {
    icon: CalendarDays,
    title: 'Full member context',
    body: 'Staff see the membership tier, whether it is active or frozen, visits this month and upcoming classes without leaving the ticket.',
  },
  {
    icon: BookOpen,
    title: 'Grounded reply drafts',
    body: 'Answers are retrieved from the gym policy library with pgvector, and cite the exact articles they used so nobody invents a refund policy.',
  },
  {
    icon: Gauge,
    title: 'SLA that watches itself',
    body: 'Live response and resolution timers per priority, with escalation levels that rise the longer a breach goes unanswered.',
  },
  {
    icon: Slack,
    title: 'Slack escalation alerts',
    body: 'Breaches and safety reports post straight to the management channel with the member, assignee and overdue time.',
  },
];

const ROLES = [
  {
    title: 'Members',
    points: [
      'Sign up with 6-digit email verification',
      'Report equipment faults with photos',
      'See your membership, classes and visits',
      'Track the response clock on your own ticket',
    ],
  },
  {
    title: 'Staff & trainers',
    points: [
      'Queue sorted by priority and SLA deadline',
      'Membership and medical context on every ticket',
      'Review, edit or reject AI reply drafts',
      'Raise escalations straight to management',
    ],
  },
  {
    title: 'Gym managers',
    points: [
      'Manage members, staff and specialties',
      'Author the policy knowledge base',
      'Tune SLA targets per priority',
      'Audit log and full analytics',
    ],
  },
];

export default async function LandingPage() {
  const session = await getSession();
  const integrations = integrationStatus();

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 font-semibold text-ink">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Dumbbell className="h-4.5 w-4.5" aria-hidden />
            </span>
            IronCore Fitness
          </Link>

          <nav className="flex items-center gap-2">
            {session ? (
              <Link
                href={homeForRole(session.role)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700"
              >
                Go to dashboard
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex h-9 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700"
                >
                  Join IronCore
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.10]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 15% 15%, rgb(var(--brand-600)), transparent 40%), radial-gradient(circle at 85% 40%, rgb(var(--brand-500)), transparent 45%)',
          }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/30 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            IronCore Fitness · Member Support Desk
          </span>

          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-5xl">
            Train hard. <span className="text-brand-600">We handle everything else.</span>
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
            Membership, classes, equipment faults, personal training and injuries — one place to
            reach the IronCore team. Every message is triaged the moment it arrives, and anything
            about member safety jumps the queue automatically.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={session ? homeForRole(session.role) : '/signup'}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-6 text-sm font-medium text-white transition-colors hover:bg-brand-700"
            >
              {session ? 'Open your dashboard' : 'Create your member account'}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center rounded-lg border border-line bg-surface px-6 text-sm font-medium text-ink transition-colors hover:bg-surface-2"
            >
              Try a demo account
            </Link>
          </div>

          <dl className="mt-12 grid max-w-3xl grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            {[
              ['15 min', 'Urgent response target'],
              ['0 sec', 'Delay on safety reports'],
              ['9', 'Support categories triaged'],
              ['24/7', 'Access for Pro & Elite'],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="text-2xl font-semibold text-ink">{value}</dt>
                <dd className="mt-0.5 text-sm text-muted">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">How the desk works</h2>
        <p className="mt-2 max-w-2xl text-muted">
          Every feature is wired end to end — real APIs, a real database, nothing mocked.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-line bg-surface p-5 shadow-card transition-shadow hover:shadow-pop"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <feature.icon className="h-4.5 w-4.5" aria-hidden />
              </span>
              <h3 className="mt-3.5 text-sm font-semibold text-ink">{feature.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            Three dashboards, one gym
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {ROLES.map((role) => (
              <div key={role.title} className="rounded-xl border border-line bg-bg p-5">
                <h3 className="text-sm font-semibold text-ink">{role.title}</h3>
                <ul className="mt-3 space-y-2">
                  {role.points.map((point) => (
                    <li key={point} className="flex gap-2 text-sm text-muted">
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500"
                        aria-hidden
                      />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Status + demo payment notice */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-line bg-surface p-5 lg:col-span-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <ShieldCheck className="h-4 w-4 text-brand-600" aria-hidden />
              Live integration status
            </h3>
            <p className="mt-1.5 text-sm text-muted">
              Optional services degrade to a documented local fallback, so the desk is fully
              functional with or without external keys.
            </p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: 'Email (Brevo)',
                  value: integrations.email === 'brevo' ? 'Connected' : 'Console fallback',
                  ok: integrations.email === 'brevo',
                },
                {
                  label: 'AI (OpenAI)',
                  value: integrations.ai === 'openai' ? 'Connected' : 'Local engine',
                  ok: integrations.ai === 'openai',
                },
                {
                  label: 'Slack alerts',
                  value: integrations.slack === 'webhook' ? 'Connected' : 'In-app only',
                  ok: integrations.slack === 'webhook',
                },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-line bg-bg px-3.5 py-3">
                  <dt className="text-xs text-muted">{item.label}</dt>
                  <dd className="mt-1 flex items-center gap-1.5 text-sm font-medium text-ink">
                    <span
                      className={`h-2 w-2 rounded-full ${item.ok ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      aria-hidden
                    />
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-xl border border-dashed border-amber-500/70 bg-amber-50 p-5 dark:bg-amber-500/10">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              Demo payment — no real money
            </p>
            <p className="mt-2 text-sm text-amber-900/90 dark:text-amber-200/90">
              The membership checkout simulates a payment gateway for demonstration only. No card
              data is transmitted, stored or charged, and no real payment processor is contacted.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted sm:px-6">
          <p className="flex items-center gap-2">
            <Dumbbell className="h-4 w-4" aria-hidden />
            IronCore Fitness — member support desk with AI triage.
          </p>
          <p className="flex items-center gap-1.5">
            <MessagesSquare className="h-3.5 w-3.5" aria-hidden />
            <BarChart3 className="h-3.5 w-3.5" aria-hidden />
            Next.js · TypeScript · Prisma · PostgreSQL + pgvector
          </p>
        </div>
      </footer>
    </div>
  );
}

import { Bot, Dumbbell, HeartPulse, Gauge, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

const HIGHLIGHTS = [
  {
    icon: Bot,
    title: 'Triaged the moment you send it',
    body: 'Every message is classified, prioritised and routed to the right person automatically.',
  },
  {
    icon: HeartPulse,
    title: 'Safety never waits in a queue',
    body: 'Anything mentioning an injury or a hazard is escalated to the duty manager instantly.',
  },
  {
    icon: Gauge,
    title: 'You can see the clock too',
    body: 'Live response targets on your own ticket — no wondering whether anyone picked it up.',
  },
];

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_minmax(0,520px)]">
      {/* Marketing panel — hidden on small screens so the form gets full width */}
      <aside className="relative hidden overflow-hidden bg-brand-600 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(255,255,255,.35), transparent 45%), radial-gradient(circle at 80% 70%, rgba(255,255,255,.25), transparent 40%)',
          }}
          aria-hidden
        />
        <Link href="/" className="relative flex items-center gap-2.5 text-lg font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
            <Dumbbell className="h-5 w-5" aria-hidden />
          </span>
          IronCore Fitness
        </Link>

        <div className="relative space-y-8">
          <div>
            <h2 className="max-w-md text-3xl font-semibold leading-tight">
              Train hard. We handle the rest.
            </h2>
            <p className="mt-3 max-w-md text-sm text-white/80">
              Membership, classes, equipment, personal training — one place to reach the IronCore
              team, and a fast answer every time.
            </p>
          </div>

          <ul className="space-y-5">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex gap-3.5">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <item.icon className="h-4.5 w-4.5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-0.5 max-w-sm text-sm text-white/70">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative flex items-center gap-2 text-xs text-white/70">
          <ShieldCheck className="h-4 w-4" aria-hidden />
          Sessions are signed JWTs in httpOnly cookies. Passwords are bcrypt-hashed.
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex flex-col justify-center bg-surface px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="mb-8 flex items-center gap-2.5 text-base font-semibold text-ink lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Dumbbell className="h-4.5 w-4.5" aria-hidden />
            </span>
            IronCore Fitness
          </Link>

          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          <p className="mt-1.5 text-sm text-muted">{subtitle}</p>

          <div className="mt-7">{children}</div>

          {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

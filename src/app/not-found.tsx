import { Compass } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-8 text-center shadow-card">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-muted">
          <Compass className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-ink">Page not found</h1>
        <p className="mt-1.5 text-sm text-muted">
          The page you&apos;re looking for doesn&apos;t exist or you no longer have access to it.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex h-10 items-center rounded-lg bg-brand-600 px-5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}

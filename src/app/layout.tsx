import type { Metadata, Viewport } from 'next';

import { ToastProvider } from '@/components/ui/Toast';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'IronCore Fitness — Member Support Desk',
    template: '%s · IronCore Fitness',
  },
  description:
    'The IronCore Fitness member support desk: AI-triaged tickets, membership and class context, RAG-powered reply drafts, SLA automation and Slack escalation alerts.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafaf9' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0a09' },
  ],
  width: 'device-width',
  initialScale: 1,
};

/**
 * Applies the stored theme before first paint so a dark-mode user never sees a
 * white flash. Kept inline and tiny on purpose.
 */
const THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('ic-theme');
    // IronCore is dark-first: with no stored choice we default to dark rather
    // than following the OS, so the brand reads as intended on first visit.
    if (stored !== 'light') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-bg text-ink">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

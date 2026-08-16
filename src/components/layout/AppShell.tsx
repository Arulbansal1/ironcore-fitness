'use client';

import {
  Bell,
  Dumbbell,
  ChevronDown,
  LogOut,
  Menu,
  Moon,
  Sun,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { apiFetch } from '@/lib/api-client';
import { cn, initials } from '@/lib/utils';

import { NotificationPanel } from './NotificationPanel';

export type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  /** Match nested routes too (default true for non-root items). */
  exact?: boolean;
};

export type ShellUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarColor: string;
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Gym manager',
  STAFF: 'IronCore staff',
  MEMBER: 'Member',
};

export function AppShell({
  user,
  nav,
  workspaceLabel,
  children,
  initialUnread = 0,
}: {
  user: ShellUser;
  nav: NavItem[];
  workspaceLabel: string;
  children: ReactNode;
  initialUnread?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [dark, setDark] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  // Close transient UI on navigation.
  useEffect(() => {
    setSidebarOpen(false);
    setMenuOpen(false);
    setNotificationsOpen(false);
  }, [pathname]);

  // Keep the unread badge fresh without a websocket.
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const data = await apiFetch<{ unreadNotifications?: number }>('/api/auth/me');
        if (!cancelled && typeof data.unreadNotifications === 'number') {
          setUnread(data.unreadNotifications);
        }
      } catch {
        /* transient network problems are not worth surfacing here */
      }
    };
    const interval = setInterval(poll, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const toggleTheme = useCallback(() => {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('ic-theme', next ? 'dark' : 'light');
    setDark(next);
  }, []);

  async function signOut() {
    setSigningOut(true);
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/login');
      router.refresh();
    }
  }

  const isActive = (item: NavItem) =>
    item.exact ?? false ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <div className="min-h-screen bg-bg">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-line bg-surface transition-transform duration-200 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-15 items-center justify-between border-b border-line px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5 font-semibold text-ink">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Dumbbell className="h-4.5 w-4.5" aria-hidden />
            </span>
            <span className="text-sm">IronCore Fitness</span>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-ink lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4.5 w-4.5" aria-hidden />
          </button>
        </div>

        <div className="px-4 pb-2 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{workspaceLabel}</p>
        </div>

        <nav className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive(item)
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-muted hover:bg-surface-2 hover:text-ink',
              )}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="border-t border-line p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: user.avatarColor }}
              aria-hidden
            >
              {initials(user.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{user.name}</p>
              <p className="truncate text-xs text-muted">{ROLE_LABEL[user.role] ?? user.role}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-15 items-center gap-3 border-b border-line bg-surface/85 px-4 py-3 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>

          <div className="flex-1" />

          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {dark ? <Sun className="h-4.5 w-4.5" aria-hidden /> : <Moon className="h-4.5 w-4.5" aria-hidden />}
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setNotificationsOpen((v) => !v);
                setMenuOpen(false);
              }}
              className="relative rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
              aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
            >
              <Bell className="h-4.5 w-4.5" aria-hidden />
              {unread > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <NotificationPanel
                onClose={() => setNotificationsOpen(false)}
                onUnreadChange={setUnread}
              />
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setMenuOpen((v) => !v);
                setNotificationsOpen(false);
              }}
              className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-surface-2"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                style={{ backgroundColor: user.avatarColor }}
                aria-hidden
              >
                {initials(user.name)}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted" aria-hidden />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
                <div
                  role="menu"
                  className="absolute right-0 z-20 mt-2 w-56 animate-fade-in overflow-hidden rounded-xl border border-line bg-surface shadow-pop"
                >
                  <div className="border-b border-line px-3.5 py-3">
                    <p className="truncate text-sm font-medium text-ink">{user.name}</p>
                    <p className="truncate text-xs text-muted">{user.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={signOut}
                    disabled={signingOut}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm text-ink transition-colors hover:bg-surface-2 disabled:opacity-60"
                    role="menuitem"
                  >
                    <LogOut className="h-4 w-4 text-muted" aria-hidden />
                    {signingOut ? 'Signing out…' : 'Sign out'}
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

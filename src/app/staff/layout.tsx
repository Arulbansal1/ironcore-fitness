import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  Inbox,
  LayoutDashboard,
  Sparkles,
} from 'lucide-react';
import { redirect } from 'next/navigation';

import { AppShell, type NavItem } from '@/components/layout/AppShell';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const NAV: NavItem[] = [
  { href: '/staff', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" />, exact: true },
  { href: '/staff/tickets', label: 'Ticket queue', icon: <Inbox className="h-4 w-4" /> },
  { href: '/staff/ai-drafts', label: 'AI drafts', icon: <Sparkles className="h-4 w-4" /> },
  { href: '/staff/escalations', label: 'Escalations', icon: <AlertTriangle className="h-4 w-4" /> },
  { href: '/staff/classes', label: 'Timetable', icon: <CalendarDays className="h-4 w-4" /> },
  { href: '/staff/knowledge-base', label: 'Knowledge base', icon: <BookOpen className="h-4 w-4" /> },
];

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect('/login?next=/staff');
  if (user.role !== 'STAFF' && user.role !== 'ADMIN') redirect('/member');

  const unread = await prisma.notification.count({ where: { userId: user.id, readAt: null } });

  return (
    <AppShell user={user} nav={NAV} workspaceLabel="Staff workspace" initialUnread={unread}>
      {children}
    </AppShell>
  );
}

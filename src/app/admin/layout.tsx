import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  History,
  LayoutDashboard,
  Ticket,
  Timer,
  Users,
} from 'lucide-react';
import { redirect } from 'next/navigation';

import { AppShell, type NavItem } from '@/components/layout/AppShell';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const NAV: NavItem[] = [
  { href: '/admin', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" />, exact: true },
  { href: '/admin/analytics', label: 'Analytics', icon: <BarChart3 className="h-4 w-4" /> },
  { href: '/admin/tickets', label: 'All tickets', icon: <Ticket className="h-4 w-4" /> },
  { href: '/admin/users', label: 'Users & staff', icon: <Users className="h-4 w-4" /> },
  { href: '/admin/knowledge-base', label: 'Knowledge base', icon: <BookOpen className="h-4 w-4" /> },
  { href: '/admin/sla', label: 'SLA policies', icon: <Timer className="h-4 w-4" /> },
  { href: '/admin/escalations', label: 'Escalations', icon: <AlertTriangle className="h-4 w-4" /> },
  { href: '/admin/audit', label: 'Audit log', icon: <History className="h-4 w-4" /> },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect('/login?next=/admin');
  if (user.role !== 'ADMIN') redirect(user.role === 'STAFF' ? '/staff' : '/member');

  const unread = await prisma.notification.count({ where: { userId: user.id, readAt: null } });

  return (
    <AppShell user={user} nav={NAV} workspaceLabel="Administration" initialUnread={unread}>
      {children}
    </AppShell>
  );
}

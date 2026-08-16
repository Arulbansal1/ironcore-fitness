import {
  BookOpen,
  CalendarDays,
  CreditCard,
  Dumbbell,
  LayoutDashboard,
  PlusCircle,
  Ticket,
} from 'lucide-react';
import { redirect } from 'next/navigation';

import { AppShell, type NavItem } from '@/components/layout/AppShell';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const NAV: NavItem[] = [
  { href: '/member', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" />, exact: true },
  { href: '/member/tickets/new', label: 'New ticket', icon: <PlusCircle className="h-4 w-4" />, exact: true },
  { href: '/member/tickets', label: 'My tickets', icon: <Ticket className="h-4 w-4" /> },
  { href: '/member/classes', label: 'Classes', icon: <CalendarDays className="h-4 w-4" /> },
  { href: '/member/membership', label: 'My membership', icon: <Dumbbell className="h-4 w-4" /> },
  { href: '/member/knowledge-base', label: 'Help centre', icon: <BookOpen className="h-4 w-4" /> },
  { href: '/member/billing', label: 'Billing (demo)', icon: <CreditCard className="h-4 w-4" /> },
];

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect('/login?next=/member');
  if (!user.emailVerified) redirect(`/verify-email?email=${encodeURIComponent(user.email)}`);

  const unread = await prisma.notification.count({ where: { userId: user.id, readAt: null } });

  return (
    <AppShell user={user} nav={NAV} workspaceLabel="Member portal" initialUnread={unread}>
      {children}
    </AppShell>
  );
}

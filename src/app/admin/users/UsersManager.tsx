'use client';

import { Search, Settings2, ShieldCheck, UserCheck, UserX } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { Checkbox, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { StatTile } from '@/components/ui/StatTile';
import { useToast } from '@/components/ui/Toast';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { TICKET_CATEGORIES } from '@/lib/constants';
import { cn, formatDate, initials, relativeTime, titleCase } from '@/lib/utils';

type StaffProfile = {
  title: string;
  specialties: string[];
  maxOpenTickets: number;
  isAvailable: boolean;
};

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  emailVerified: boolean;
  phone: string | null;
  avatarColor: string;
  lastLoginAt: string | null;
  createdAt: string;
  staffProfile: StaffProfile | null;
  _count: { ticketsAsMember: number; ticketsAsOwner: number };
};

const ROLE_TONE = { ADMIN: 'danger', STAFF: 'brand', MEMBER: 'neutral' } as const;

export function UsersManager({
  users,
  counts,
  currentUserId,
}: {
  users: ManagedUser[];
  counts: Record<string, number>;
  currentUserId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter !== 'ALL' && user.role !== roleFilter) return false;
      if (!term) return true;
      return (
        user.name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        (user.phone ?? '').toLowerCase().includes(term)
      );
    });
  }, [users, search, roleFilter]);

  async function patchUser(id: string, body: Record<string, unknown>, successMessage: string) {
    setBusy(id);
    try {
      await apiFetch(`/api/admin/users/${id}`, { method: 'PATCH', body });
      toast.success(successMessage);
      setEditing(null);
      router.refresh();
    } catch (caught) {
      toast.error('Could not update the user', errorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Members"
          value={counts.MEMBER ?? 0}
          icon={<UserCheck className="h-4 w-4" />}
        />
        <StatTile label="Agents" value={counts.STAFF ?? 0} icon={<Settings2 className="h-4 w-4" />} tone="brand" />
        <StatTile
          label="Administrators"
          value={counts.ADMIN ?? 0}
          icon={<ShieldCheck className="h-4 w-4" />}
          tone="danger"
        />
      </div>

      <div className="mt-5 mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email or phone…"
            aria-label="Search users"
            className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-ink"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
          aria-label="Filter by role"
          className="h-10 cursor-pointer rounded-lg border border-line bg-surface px-3 text-sm text-ink"
        >
          <option value="ALL">All roles</option>
          <option value="MEMBER">Members</option>
          <option value="STAFF">Agents</option>
          <option value="ADMIN">Administrators</option>
        </select>
      </div>

      <Card>
        <CardHeader
          title={`${filtered.length} user${filtered.length === 1 ? '' : 's'}`}
          description="Role changes take effect on the user's next request"
        />

        {filtered.length === 0 ? (
          <EmptyState title="No users match" description="Try a different search or role filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-4 py-2.5 font-medium sm:px-5">User</th>
                  <th className="px-4 py-2.5 font-medium">Role</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Tickets</th>
                  <th className="px-4 py-2.5 font-medium">Last seen</th>
                  <th className="px-4 py-2.5 text-right font-medium sm:px-5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((user) => (
                  <tr key={user.id} className={cn(!user.isActive && 'opacity-60')}>
                    <td className="px-4 py-3 sm:px-5">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                          style={{ backgroundColor: user.avatarColor }}
                          aria-hidden
                        >
                          {initials(user.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">
                            {user.name}
                            {user.id === currentUserId && (
                              <span className="ml-1.5 text-xs font-normal text-muted">(you)</span>
                            )}
                          </p>
                          <p className="truncate text-xs text-muted">{user.email}</p>
                          {user.staffProfile && (
                            <p className="truncate text-xs text-muted">
                              {user.staffProfile.title}
                              {user.staffProfile.specialties.length > 0 &&
                                ` · ${user.staffProfile.specialties.map(titleCase).join(', ')}`}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={ROLE_TONE[user.role as keyof typeof ROLE_TONE] ?? 'neutral'}>
                        {titleCase(user.role)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Badge tone={user.isActive ? 'success' : 'danger'} dot>
                          {user.isActive ? 'Active' : 'Deactivated'}
                        </Badge>
                        {!user.emailVerified && <Badge tone="warning">Unverified</Badge>}
                        {user.staffProfile && !user.staffProfile.isAvailable && (
                          <Badge tone="neutral">Away</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {user.role === 'MEMBER'
                        ? user._count.ticketsAsMember
                        : `${user._count.ticketsAsOwner} assigned`}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {user.lastLoginAt ? relativeTime(user.lastLoginAt) : 'Never'}
                      <span className="block">Joined {formatDate(user.createdAt)}</span>
                    </td>
                    <td className="px-4 py-3 text-right sm:px-5">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setEditing(user)}>
                          Manage
                        </Button>
                        {user.id !== currentUserId && (
                          <Button
                            size="sm"
                            variant={user.isActive ? 'ghost' : 'success'}
                            loading={busy === user.id}
                            onClick={() =>
                              patchUser(
                                user.id,
                                { isActive: !user.isActive },
                                user.isActive ? 'User deactivated.' : 'User reactivated.',
                              )
                            }
                          >
                            {user.isActive ? (
                              <UserX className="h-3.5 w-3.5" aria-hidden />
                            ) : (
                              <UserCheck className="h-3.5 w-3.5" aria-hidden />
                            )}
                            {user.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && (
        <EditUserModal
          user={editing}
          isSelf={editing.id === currentUserId}
          busy={busy === editing.id}
          onClose={() => setEditing(null)}
          onSave={(body) => patchUser(editing.id, body, 'User updated.')}
        />
      )}
    </>
  );
}

function EditUserModal({
  user,
  isSelf,
  busy,
  onClose,
  onSave,
}: {
  user: ManagedUser;
  isSelf: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (body: Record<string, unknown>) => void;
}) {
  const [role, setRole] = useState(user.role);
  const [title, setTitle] = useState(user.staffProfile?.title ?? 'Support Staff');
  const [specialties, setSpecialties] = useState<string[]>(user.staffProfile?.specialties ?? []);
  const [maxOpen, setMaxOpen] = useState(String(user.staffProfile?.maxOpenTickets ?? 15));
  const [available, setAvailable] = useState(user.staffProfile?.isAvailable ?? true);

  const showsAgentFields = role === 'STAFF';

  function submit() {
    const body: Record<string, unknown> = {};
    if (role !== user.role) body.role = role;
    if (showsAgentFields) {
      body.staffProfile = {
        title: title.trim() || 'Support Staff',
        specialties,
        maxOpenTickets: Math.min(Math.max(Number(maxOpen) || 15, 1), 200),
        isAvailable: available,
      };
    }
    onSave(body);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Manage ${user.name}`}
      description={user.email}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Role"
          value={role}
          onChange={(event) => setRole(event.target.value)}
          disabled={isSelf}
          hint={
            isSelf
              ? 'You cannot change your own role — ask another administrator.'
              : 'Promoting to Staff creates a routing profile so AI triage can auto-assign work.'
          }
          options={[
            { value: 'MEMBER', label: 'Member' },
            { value: 'STAFF', label: 'Staff' },
            { value: 'ADMIN', label: 'Administrator' },
          ]}
        />

        {showsAgentFields && (
          <>
            <Input
              label="Job title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Senior Support Staff"
            />

            <div>
              <span className="mb-1.5 block text-sm font-medium text-ink">Specialties</span>
              <p className="mb-2 text-xs text-muted">
                AI triage prefers a staff whose specialties match the ticket category.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {TICKET_CATEGORIES.map((category) => {
                  const selected = specialties.includes(category.value);
                  return (
                    <button
                      key={category.value}
                      type="button"
                      onClick={() =>
                        setSpecialties((current) =>
                          selected
                            ? current.filter((c) => c !== category.value)
                            : [...current, category.value],
                        )
                      }
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                        selected
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-line text-muted hover:text-ink',
                      )}
                    >
                      {category.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <Input
              label="Maximum open tickets"
              type="number"
              min={1}
              max={200}
              value={maxOpen}
              onChange={(event) => setMaxOpen(event.target.value)}
              hint="Auto-assignment skips a staff who is already at capacity."
            />

            <Checkbox
              label="Available for assignment"
              hint="Turn off when the staff is on leave — they will be skipped by auto-assignment."
              checked={available}
              onChange={(event) => setAvailable(event.target.checked)}
            />
          </>
        )}
      </div>
    </Modal>
  );
}

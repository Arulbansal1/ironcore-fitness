'use client';

import {
  AlertTriangle,
  CalendarDays,
  Dumbbell,
  HeartPulse,
  Phone,
  Snowflake,
  Star,
  User,
} from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { formatDate, initials, relativeTime } from '@/lib/utils';

export type MemberContext = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarColor: string;
  createdAt: string;
  profile: {
    memberNumber: string;
    tier: string;
    status: string;
    joinedAt: string;
    expiresAt: string | null;
    frozenUntil: string | null;
    freezeReason: string | null;
    homeBranch: string;
    goals: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    medicalNotes: string | null;
  } | null;
  visitsThisMonth: number;
  lastVisitAt: string | null;
  upcomingBookings: Array<{
    id: string;
    className: string;
    trainerName: string | null;
    sessionDate: string;
    startTime: string;
    room: string;
    status: string;
  }>;
};

const TIER_TONE: Record<string, 'neutral' | 'brand' | 'success' | 'purple'> = {
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

function labelOf(value: string) {
  return value
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * The member record a staff member needs while answering a ticket: what they pay
 * for, whether the membership is actually live, how often they train, and what
 * they have booked next.
 *
 * Medical notes and emergency contacts are shown to staff only, and only appear
 * when something is recorded — an empty "Medical notes: none" row would train
 * staff to skip the section entirely.
 */
export function MemberContextPanel({
  member,
  showSafetyDetails,
}: {
  member: MemberContext;
  showSafetyDetails: boolean;
}) {
  const profile = member.profile;
  const expiringSoon =
    profile?.expiresAt && new Date(profile.expiresAt).getTime() - Date.now() < 30 * 86_400_000;

  return (
    <Card>
      <CardHeader title="Member" icon={<User className="h-4 w-4" />} />
      <CardBody className="space-y-3.5">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: member.avatarColor }}
            aria-hidden
          >
            {initials(member.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{member.name}</p>
            <p className="truncate text-xs text-muted">{member.email}</p>
          </div>
        </div>

        {profile ? (
          <>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={TIER_TONE[profile.tier] ?? 'neutral'}>{labelOf(profile.tier)}</Badge>
              <Badge tone={STATUS_TONE[profile.status] ?? 'neutral'} dot>
                {labelOf(profile.status)}
              </Badge>
              <Badge tone="neutral">{profile.memberNumber}</Badge>
            </div>

            {profile.status === 'FROZEN' && (
              <p className="flex items-start gap-1.5 rounded-lg bg-sky-50 px-2.5 py-2 text-xs text-sky-900 dark:bg-sky-500/10 dark:text-sky-200">
                <Snowflake className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>
                  Membership frozen
                  {profile.frozenUntil ? ` until ${formatDate(profile.frozenUntil)}` : ''}
                  {profile.freezeReason ? ` — ${profile.freezeReason}` : ''}. They should not be
                  billed while frozen.
                </span>
              </p>
            )}

            {(profile.status === 'EXPIRED' || profile.status === 'CANCELLED') && (
              <p className="flex items-start gap-1.5 rounded-lg bg-red-50 px-2.5 py-2 text-xs text-red-900 dark:bg-red-500/10 dark:text-red-200">
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>
                  This membership is {profile.status.toLowerCase()} — check before promising access
                  or bookings.
                </span>
              </p>
            )}

            <dl className="space-y-2 border-t border-line pt-3 text-sm">
              <Row label="Member since" value={formatDate(profile.joinedAt)} />
              <Row
                label="Renews"
                value={profile.expiresAt ? formatDate(profile.expiresAt) : '—'}
                tone={expiringSoon ? 'warning' : undefined}
              />
              <Row label="Home gym" value={profile.homeBranch} />
              {member.phone && <Row label="Phone" value={member.phone} />}
            </dl>

            <div className="grid grid-cols-2 gap-2 border-t border-line pt-3">
              <Stat
                icon={<Dumbbell className="h-3.5 w-3.5" />}
                label="Visits this month"
                value={String(member.visitsThisMonth)}
              />
              <Stat
                icon={<CalendarDays className="h-3.5 w-3.5" />}
                label="Last visit"
                value={member.lastVisitAt ? relativeTime(member.lastVisitAt) : 'Never'}
              />
            </div>

            {profile.goals && (
              <p className="border-t border-line pt-3 text-xs leading-relaxed text-muted">
                <span className="font-medium text-ink">Goals: </span>
                {profile.goals}
              </p>
            )}

            {showSafetyDetails && profile.medicalNotes && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 dark:border-amber-500/40 dark:bg-amber-500/10">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                  <HeartPulse className="h-3.5 w-3.5" aria-hidden />
                  Medical notes on file
                </p>
                <p className="mt-1 text-xs leading-relaxed text-amber-900/90 dark:text-amber-200/90">
                  {profile.medicalNotes}
                </p>
              </div>
            )}

            {showSafetyDetails && profile.emergencyContactName && (
              <p className="flex items-start gap-1.5 text-xs text-muted">
                <Phone className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>
                  <span className="font-medium text-ink">Emergency contact: </span>
                  {profile.emergencyContactName}
                  {profile.emergencyContactPhone ? ` · ${profile.emergencyContactPhone}` : ''}
                </span>
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">
            No membership record on file — this account has not completed sign-up.
          </p>
        )}

        {member.upcomingBookings.length > 0 && (
          <div className="border-t border-line pt-3">
            <p className="mb-1.5 text-xs font-medium text-muted">Upcoming classes</p>
            <ul className="space-y-1">
              {member.upcomingBookings.map((booking) => (
                <li key={booking.id} className="rounded-md bg-surface-2/60 px-2.5 py-1.5">
                  <p className="text-xs font-medium text-ink">
                    {booking.className}
                    {booking.status === 'WAITLISTED' && (
                      <span className="ml-1.5 text-amber-600 dark:text-amber-400">(waitlist)</span>
                    )}
                  </p>
                  <p className="text-[11px] text-muted">
                    {formatDate(booking.sessionDate)} · {booking.startTime} · {booking.room}
                    {booking.trainerName ? ` · ${booking.trainerName}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'warning';
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-xs text-muted">{label}</dt>
      <dd
        className={
          tone === 'warning'
            ? 'min-w-0 text-right text-sm font-medium text-amber-600 dark:text-amber-400'
            : 'min-w-0 text-right text-sm text-ink'
        }
      >
        {value}
      </dd>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line px-2.5 py-2">
      <p className="flex items-center gap-1 text-[11px] text-muted">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

/** Compact membership chip used in ticket lists. */
export function MembershipChip({
  tier,
  status,
}: {
  tier: string;
  status: string;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <Badge tone={TIER_TONE[tier] ?? 'neutral'}>{labelOf(tier)}</Badge>
      {status !== 'ACTIVE' && (
        <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{labelOf(status)}</Badge>
      )}
    </span>
  );
}

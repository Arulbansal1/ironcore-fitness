'use client';

import { CalendarDays, Clock, MapPin, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, EmptyState } from '@/components/ui/Card';
import { Alert, Spinner } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { DAY_NAMES } from '@/lib/constants';
import { cn, formatDate } from '@/lib/utils';

type Session = {
  id: string;
  name: string;
  description: string;
  dayOfWeek: number;
  startTime: string;
  durationMins: number;
  room: string;
  intensity: string;
  capacity: number;
  booked: number;
  spacesLeft: number;
  waitlistCount: number;
  trainer: { id: string; name: string; avatarColor: string } | null;
  sessionDate: string;
  myBooking: { id: string; status: string } | null;
};

const INTENSITY_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  Low: 'success',
  Moderate: 'warning',
  High: 'danger',
};

export function ClassTimetable({ canBook, membershipStatus }: { canBook: boolean; membershipStatus: string }) {
  const toast = useToast();
  const [week, setWeek] = useState(0);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (weekOffset: number) => {
    setLoading(true);
    try {
      const data = await apiFetch<{ timetable: Session[] }>(`/api/classes?week=${weekOffset}`);
      setSessions(data.timetable);
      setError(null);
    } catch (caught) {
      setError(errorMessage(caught, 'Could not load the timetable.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(week);
  }, [week, load]);

  async function book(session: Session) {
    setBusy(session.id);
    try {
      const result = await apiFetch<{ message: string }>('/api/classes', {
        method: 'POST',
        body: { classId: session.id, sessionDate: session.sessionDate },
      });
      toast.success(result.message);
      await load(week);
    } catch (caught) {
      toast.error('Could not book', errorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  async function cancel(session: Session) {
    if (!session.myBooking) return;
    setBusy(session.id);
    try {
      const result = await apiFetch<{ message: string }>('/api/classes', {
        method: 'DELETE',
        body: { bookingId: session.myBooking.id },
      });
      toast.success(result.message);
      await load(week);
    } catch (caught) {
      toast.error('Could not cancel', errorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  const byDay = sessions.reduce<Record<number, Session[]>>((acc, session) => {
    (acc[session.dayOfWeek] ??= []).push(session);
    return acc;
  }, {});

  const orderedDays = [1, 2, 3, 4, 5, 6, 0].filter((day) => byDay[day]?.length);

  return (
    <div className="space-y-4">
      {!canBook && (
        <Alert tone="warning" title={`Your membership is ${membershipStatus.toLowerCase()}`}>
          You can browse the timetable, but booking is unavailable until your membership is active
          again. Open a ticket and the front desk will help.
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg border border-line bg-surface p-0.5">
          {[0, 1, 2].map((offset) => (
            <button
              key={offset}
              type="button"
              onClick={() => setWeek(offset)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                week === offset ? 'bg-brand-600 text-white' : 'text-muted hover:text-ink',
              )}
            >
              {offset === 0 ? 'This week' : offset === 1 ? 'Next week' : 'In 2 weeks'}
            </button>
          ))}
        </div>
        {loading && <Spinner label="Loading timetable…" />}
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {!loading && sessions.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarDays className="h-5 w-5" />}
            title="No classes on the timetable"
            description="Check back soon — the timetable is updated weekly."
          />
        </Card>
      ) : (
        orderedDays.map((day) => (
          <Card key={day}>
            <CardHeader
              title={DAY_NAMES[day]}
              description={
                byDay[day][0] ? formatDate(byDay[day][0].sessionDate) : undefined
              }
              icon={<CalendarDays className="h-4 w-4" />}
            />
            <CardBody className="space-y-2.5">
              {byDay[day].map((session) => {
                const isFull = session.spacesLeft === 0;
                const myStatus = session.myBooking?.status;

                return (
                  <div
                    key={session.id}
                    className={cn(
                      'flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3.5 transition-colors',
                      myStatus === 'BOOKED'
                        ? 'border-brand-500/50 bg-brand-50/40'
                        : 'border-line hover:bg-surface-2/40',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-ink">{session.name}</h3>
                        <Badge tone={INTENSITY_TONE[session.intensity] ?? 'neutral'}>
                          {session.intensity}
                        </Badge>
                        {myStatus === 'BOOKED' && <Badge tone="brand" dot>Booked</Badge>}
                        {myStatus === 'WAITLISTED' && <Badge tone="warning" dot>Waitlisted</Badge>}
                      </div>

                      <p className="mt-1 text-sm leading-relaxed text-muted">{session.description}</p>

                      <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-muted">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" aria-hidden />
                          {session.startTime} · {session.durationMins} min
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" aria-hidden />
                          {session.room}
                        </span>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1',
                            isFull && 'font-medium text-amber-600 dark:text-amber-400',
                          )}
                        >
                          <Users className="h-3.5 w-3.5" aria-hidden />
                          {isFull
                            ? `Full${session.waitlistCount > 0 ? ` · ${session.waitlistCount} waiting` : ''}`
                            : `${session.spacesLeft} of ${session.capacity} left`}
                        </span>
                        {session.trainer && <span>with {session.trainer.name}</span>}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {myStatus === 'BOOKED' || myStatus === 'WAITLISTED' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          loading={busy === session.id}
                          onClick={() => cancel(session)}
                        >
                          Cancel
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant={isFull ? 'outline' : 'primary'}
                          disabled={!canBook}
                          loading={busy === session.id}
                          onClick={() => book(session)}
                        >
                          {isFull ? 'Join waitlist' : 'Book'}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardBody>
          </Card>
        ))
      )}
    </div>
  );
}

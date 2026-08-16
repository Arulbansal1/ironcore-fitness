'use client';

import { Search, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import { cn } from '@/lib/utils';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'PENDING_MEMBER', label: 'Pending member' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'All priorities' },
  { value: 'URGENT', label: 'Urgent' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
];

const CATEGORY_OPTIONS = [
  { value: '', label: 'All categories' },
  { value: 'BILLING', label: 'Billing' },
  { value: 'TECHNICAL', label: 'Technical' },
  { value: 'ACCOUNT', label: 'Account' },
  { value: 'BUG', label: 'Bug' },
  { value: 'FEATURE_REQUEST', label: 'Feature request' },
  { value: 'SHIPPING', label: 'Shipping' },
  { value: 'GENERAL', label: 'General' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'priority', label: 'Highest priority' },
  { value: 'sla', label: 'SLA deadline' },
];

/**
 * URL-driven filters. Every change writes to the query string, so the list is
 * shareable, bookmarkable and survives a refresh.
 */
export function TicketFilters({
  showAssignment = false,
  staff = [],
}: {
  showAssignment?: boolean;
  staff?: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(params.get('search') ?? '');

  // Debounce the free-text search so we don't navigate on every keystroke.
  useEffect(() => {
    const current = params.get('search') ?? '';
    if (search === current) return;

    const timer = setTimeout(() => {
      updateParam('search', search);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  const activeCount = ['status', 'priority', 'category', 'assigneeId', 'breached', 'search'].filter((key) =>
    params.get(key),
  ).length;

  function clearAll() {
    setSearch('');
    startTransition(() => router.push(pathname));
  }

  return (
    <div className={cn('space-y-3', isPending && 'opacity-70')}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by subject, description or ticket number…"
          aria-label="Search tickets"
          className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-muted/70"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          label="Status"
          value={params.get('status') ?? ''}
          options={STATUS_OPTIONS}
          onChange={(value) => updateParam('status', value)}
        />
        <FilterSelect
          label="Priority"
          value={params.get('priority') ?? ''}
          options={PRIORITY_OPTIONS}
          onChange={(value) => updateParam('priority', value)}
        />
        <FilterSelect
          label="Category"
          value={params.get('category') ?? ''}
          options={CATEGORY_OPTIONS}
          onChange={(value) => updateParam('category', value)}
        />
        {showAssignment && (
          <FilterSelect
            label="Assignee"
            value={params.get('assigneeId') ?? ''}
            options={[
              { value: '', label: 'Anyone' },
              { value: 'unassigned', label: 'Unassigned' },
              ...staff.map((a) => ({ value: a.id, label: a.name })),
            ]}
            onChange={(value) => updateParam('assigneeId', value)}
          />
        )}
        <FilterSelect
          label="Sort"
          value={params.get('sort') ?? 'newest'}
          options={SORT_OPTIONS}
          onChange={(value) => updateParam('sort', value === 'newest' ? '' : value)}
        />

        {showAssignment && (
          <button
            type="button"
            onClick={() => updateParam('breached', params.get('breached') === 'true' ? '' : 'true')}
            className={cn(
              'h-9 rounded-lg border px-3 text-sm font-medium transition-colors',
              params.get('breached') === 'true'
                ? 'border-red-300 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
                : 'border-line bg-surface text-muted hover:text-ink',
            )}
          >
            SLA breached
          </button>
        )}

        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-sm font-medium text-muted transition-colors hover:text-ink"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Clear ({activeCount})
          </button>
        )}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      aria-label={label}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        'h-9 cursor-pointer rounded-lg border bg-surface px-2.5 text-sm transition-colors',
        value ? 'border-brand-500 text-ink' : 'border-line text-muted hover:text-ink',
      )}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

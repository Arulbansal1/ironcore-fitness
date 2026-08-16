'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { cn } from '@/lib/utils';

export type PaginationState = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

/** Query-string pagination shared by every list view. */
export function Pagination({ pagination }: { pagination: PaginationState }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  if (pagination.totalPages <= 1) return null;

  const goTo = (page: number) => {
    const next = new URLSearchParams(params.toString());
    if (page <= 1) next.delete('page');
    else next.set('page', String(page));
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const first = (pagination.page - 1) * pagination.pageSize + 1;
  const last = Math.min(pagination.page * pagination.pageSize, pagination.total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5">
      <p className="text-xs text-muted">
        Showing <span className="font-medium text-ink">{first}</span>–
        <span className="font-medium text-ink">{last}</span> of{' '}
        <span className="font-medium text-ink">{pagination.total}</span>
      </p>

      <div className="flex items-center gap-1">
        <PageButton
          onClick={() => goTo(pagination.page - 1)}
          disabled={pagination.page <= 1}
          label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </PageButton>

        {buildPageRange(pagination.page, pagination.totalPages).map((entry, index) =>
          entry === '…' ? (
            <span key={`gap-${index}`} className="px-1.5 text-sm text-muted">
              …
            </span>
          ) : (
            <button
              key={entry}
              type="button"
              onClick={() => goTo(entry)}
              aria-current={entry === pagination.page ? 'page' : undefined}
              className={cn(
                'h-8 min-w-8 rounded-lg px-2 text-sm font-medium transition-colors',
                entry === pagination.page
                  ? 'bg-brand-600 text-white'
                  : 'text-muted hover:bg-surface-2 hover:text-ink',
              )}
            >
              {entry}
            </button>
          ),
        )}

        <PageButton
          onClick={() => goTo(pagination.page + 1)}
          disabled={pagination.page >= pagination.totalPages}
          label="Next page"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </PageButton>
      </div>
    </div>
  );
}

function PageButton({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function buildPageRange(current: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: Array<number | '…'> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) pages.push('…');
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (end < total - 1) pages.push('…');
  pages.push(total);

  return pages;
}

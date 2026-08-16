'use client';

import { useState } from 'react';

import { cn, titleCase } from '@/lib/utils';

import { colorForKey } from './palette';
import { useDarkMode } from './useDarkMode';

export type BreakdownDatum = { key: string; value: number };

/**
 * Horizontal bars for "magnitude by identity".
 *
 * Horizontal (not a pie): categories are ranked and directly comparable along a
 * shared baseline, and long labels stay readable without rotation. Every bar is
 * directly labelled with its value, which also satisfies the relief rule for the
 * lower-contrast light-mode hues.
 */
export function BarBreakdown({
  data,
  title,
  description,
  formatLabel = titleCase,
  total,
  emptyMessage = 'No data in this range.',
}: {
  data: BreakdownDatum[];
  title: string;
  description?: string;
  formatLabel?: (key: string) => string;
  total?: number;
  emptyMessage?: string;
}) {
  const dark = useDarkMode();
  const [showTable, setShowTable] = useState(false);

  const rows = [...data].sort((a, b) => b.value - a.value);
  const sum = total ?? rows.reduce((acc, row) => acc + row.value, 0);
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <figure className="m-0">
      <figcaption className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
        </div>
        {rows.length > 0 && (
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            className="shrink-0 text-xs font-medium text-muted transition-colors hover:text-ink"
            aria-pressed={showTable}
          >
            {showTable ? 'Chart' : 'Table'}
          </button>
        )}
      </figcaption>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">{emptyMessage}</p>
      ) : showTable ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="pb-1.5 font-medium">Category</th>
              <th className="pb-1.5 text-right font-medium">Count</th>
              <th className="pb-1.5 text-right font-medium">Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="py-1.5 text-ink">{formatLabel(row.key)}</td>
                <td className="py-1.5 text-right tabular-nums text-ink">{row.value}</td>
                <td className="py-1.5 text-right tabular-nums text-muted">
                  {sum > 0 ? `${Math.round((row.value / sum) * 100)}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((row, index) => (
            <li key={row.key}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-xs text-ink">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: colorForKey(row.key, index, dark) }}
                    aria-hidden
                  />
                  <span className="truncate">{formatLabel(row.key)}</span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted">
                  <span className="font-medium text-ink">{row.value}</span>
                  {sum > 0 && ` · ${Math.round((row.value / sum) * 100)}%`}
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-[4px] bg-surface-2">
                <div
                  className="h-full rounded-[4px]"
                  style={{
                    width: `${Math.max((row.value / max) * 100, row.value > 0 ? 2 : 0)}%`,
                    backgroundColor: colorForKey(row.key, index, dark),
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

/** Single-value progress meter using the reserved status ramp. */
export function Meter({
  label,
  percent,
  caption,
  color,
}: {
  label: string;
  percent: number | null;
  caption?: string;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-muted">{label}</span>
        <span className="text-sm font-semibold tabular-nums text-ink">
          {percent === null ? '—' : `${percent}%`}
        </span>
      </div>
      <div
        className="mt-1.5 h-2 w-full overflow-hidden rounded-[4px] bg-surface-2"
        role="progressbar"
        aria-valuenow={percent ?? 0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={cn('h-full rounded-[4px] transition-all duration-500')}
          style={{ width: `${Math.max(percent ?? 0, 2)}%`, backgroundColor: color }}
        />
      </div>
      {caption && <p className="mt-1 text-[11px] text-muted">{caption}</p>}
    </div>
  );
}

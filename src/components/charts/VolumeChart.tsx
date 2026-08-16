'use client';

import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { seriesColor } from './palette';
import { useDarkMode } from './useDarkMode';

export type VolumePoint = { date: string; created: number; resolved: number };

/**
 * Ticket volume over time: created vs resolved.
 *
 * Both series are counts of the same unit on ONE shared axis — never a dual
 * y-axis. The gap between the lines is the readable signal (backlog growing or
 * shrinking), which only works because the scales are shared.
 */
export function VolumeChart({ data }: { data: VolumePoint[] }) {
  const dark = useDarkMode();
  const [showTable, setShowTable] = useState(false);

  const createdColor = seriesColor(0, dark);
  const resolvedColor = seriesColor(2, dark);

  const totalCreated = data.reduce((sum, point) => sum + point.created, 0);
  const totalResolved = data.reduce((sum, point) => sum + point.resolved, 0);

  const formatDay = (value: string) =>
    new Date(`${value}T00:00:00Z`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });

  return (
    <figure className="m-0">
      <figcaption className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">Ticket volume</h3>
          <p className="mt-0.5 text-xs text-muted">
            {totalCreated} created · {totalResolved} resolved in this range
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Legend is always present for 2+ series — identity is never colour-alone. */}
          <ul className="flex items-center gap-3">
            <li className="flex items-center gap-1.5 text-xs text-muted">
              <span
                className="h-0.5 w-3.5 rounded-full"
                style={{ backgroundColor: createdColor }}
                aria-hidden
              />
              Created
            </li>
            <li className="flex items-center gap-1.5 text-xs text-muted">
              <span
                className="h-0.5 w-3.5 rounded-full"
                style={{ backgroundColor: resolvedColor }}
                aria-hidden
              />
              Resolved
            </li>
          </ul>
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            className="text-xs font-medium text-muted transition-colors hover:text-ink"
            aria-pressed={showTable}
          >
            {showTable ? 'Chart' : 'Table'}
          </button>
        </div>
      </figcaption>

      {showTable ? (
        <div className="scrollbar-thin max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="py-1.5 font-medium">Date</th>
                <th className="py-1.5 text-right font-medium">Created</th>
                <th className="py-1.5 text-right font-medium">Resolved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.map((point) => (
                <tr key={point.date}>
                  <td className="py-1.5 text-ink">{formatDay(point.date)}</td>
                  <td className="py-1.5 text-right tabular-nums text-ink">{point.created}</td>
                  <td className="py-1.5 text-right tabular-nums text-ink">{point.resolved}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDay}
                tickLine={false}
                axisLine={false}
                minTickGap={28}
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={44} />
              <Tooltip
                cursor={{ stroke: 'rgb(var(--line))', strokeWidth: 1 }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="rounded-lg border border-line bg-surface px-3 py-2 shadow-pop">
                      <p className="text-xs font-medium text-ink">{formatDay(String(label))}</p>
                      <ul className="mt-1 space-y-0.5">
                        {payload.map((entry) => (
                          <li key={entry.name} className="flex items-center gap-2 text-xs text-muted">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: entry.color }}
                              aria-hidden
                            />
                            {entry.name}:{' '}
                            <span className="font-medium tabular-nums text-ink">{entry.value}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="created"
                name="Created"
                stroke={createdColor}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'rgb(var(--surface))' }}
              />
              <Line
                type="monotone"
                dataKey="resolved"
                name="Resolved"
                stroke={resolvedColor}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'rgb(var(--surface))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </figure>
  );
}

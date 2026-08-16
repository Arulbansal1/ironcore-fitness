import { BarChart3 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHeader } from '@/components/layout/AppShell';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { buildAnalytics, formatMinutes, type AnalyticsRange } from '@/lib/analytics';
import { cn } from '@/lib/utils';

import { AnalyticsCharts } from './AnalyticsCharts';

export const metadata: Metadata = { title: 'Analytics' };
export const dynamic = 'force-dynamic';

const RANGES: AnalyticsRange[] = [7, 30, 90];

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const requested = Number(params.range);
  const range: AnalyticsRange = RANGES.includes(requested as AnalyticsRange)
    ? (requested as AnalyticsRange)
    : 30;

  const analytics = await buildAnalytics(range);

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Queue health, response performance, SLA compliance and AI effectiveness."
        action={
          <div className="flex gap-1 rounded-lg border border-line bg-surface p-0.5">
            {RANGES.map((option) => (
              <Link
                key={option}
                href={`/admin/analytics?range=${option}`}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  range === option ? 'bg-brand-600 text-white' : 'text-muted hover:text-ink',
                )}
              >
                {option}d
              </Link>
            ))}
          </div>
        }
      />

      <AnalyticsCharts analytics={analytics} />

      <Card className="mt-4">
        <CardHeader
          title="Staff performance"
          icon={<BarChart3 className="h-4 w-4" />}
          description={`Tickets assigned in the last ${range} days`}
        />
        {analytics.staff.length === 0 ? (
          <CardBody>
            <p className="text-sm text-muted">No staff configured.</p>
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-4 py-2.5 font-medium sm:px-5">Staff</th>
                  <th className="px-4 py-2.5 text-right font-medium">Assigned</th>
                  <th className="px-4 py-2.5 text-right font-medium">Resolved</th>
                  <th className="px-4 py-2.5 text-right font-medium">Resolution rate</th>
                  <th className="px-4 py-2.5 text-right font-medium">Avg first response</th>
                  <th className="px-4 py-2.5 text-right font-medium">CSAT</th>
                  <th className="px-4 py-2.5 text-right font-medium sm:px-5">Breaches</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {analytics.staff.map((staff) => (
                  <tr key={staff.id}>
                    <td className="px-4 py-3 sm:px-5">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: staff.avatarColor }}
                          aria-hidden
                        />
                        <span className="text-ink">{staff.name}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink">{staff.assigned}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink">{staff.resolved}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {staff.assigned > 0
                        ? `${Math.round((staff.resolved / staff.assigned) * 100)}%`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {formatMinutes(staff.avgFirstResponseMins)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {staff.avgCsat !== null ? `${staff.avgCsat}/5` : '—'}
                    </td>
                    <td
                      className={cn(
                        'px-4 py-3 text-right tabular-nums sm:px-5',
                        staff.breaches > 0 ? 'font-medium text-red-600 dark:text-red-400' : 'text-muted',
                      )}
                    >
                      {staff.breaches}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <CardHeader
          title="Most-read knowledge base articles"
          description="High-traffic articles are the ones worth keeping accurate — the AI cites them too."
        />
        {analytics.topArticles.length === 0 ? (
          <CardBody>
            <p className="text-sm text-muted">No published articles yet.</p>
          </CardBody>
        ) : (
          <ul className="divide-y divide-line">
            {analytics.topArticles.map((article) => (
              <li key={article.id}>
                <Link
                  href={`/admin/knowledge-base/${article.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-2/60 sm:px-5"
                >
                  <span className="min-w-0 truncate text-sm text-ink">{article.title}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted">{article.views} views</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="mt-4 text-xs text-muted">
        Generated {new Date(analytics.generatedAt).toLocaleString()}. SLA compliance counts a ticket
        once its outcome is decided — answered, or past its deadline — so outstanding breaches are
        included rather than hidden.
      </p>
    </>
  );
}

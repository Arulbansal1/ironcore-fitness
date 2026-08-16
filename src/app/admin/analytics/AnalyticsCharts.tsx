'use client';

import { Bot, Clock, Gauge, Ticket, TrendingDown, TrendingUp } from 'lucide-react';

import { BarBreakdown, Meter } from '@/components/charts/BarBreakdown';
import { complianceLevel, statusColor } from '@/components/charts/palette';
import { useDarkMode } from '@/components/charts/useDarkMode';
import { VolumeChart } from '@/components/charts/VolumeChart';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import type { Analytics } from '@/lib/analytics';
import { formatMinutes, titleCase } from '@/lib/utils';

export function AnalyticsCharts({ analytics }: { analytics: Analytics }) {
  const dark = useDarkMode();
  const { summary, sla, breakdown, ai } = analytics;

  const change = summary.changePercent;
  const ChangeIcon = change !== null && change < 0 ? TrendingDown : TrendingUp;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Tickets created"
          value={summary.created}
          hint={
            change === null
              ? `Last ${analytics.rangeDays} days`
              : `${change > 0 ? '+' : ''}${change}% vs previous ${analytics.rangeDays} days`
          }
          icon={<Ticket className="h-4 w-4" />}
          tone="brand"
        />
        <StatTile
          label="Median first response"
          value={formatMinutes(summary.medianFirstResponseMins)}
          hint={`p90 ${formatMinutes(summary.p90FirstResponseMins)} · avg ${formatMinutes(summary.avgFirstResponseMins)}`}
          icon={<Clock className="h-4 w-4" />}
          tone="neutral"
        />
        <StatTile
          label="Median resolution"
          value={formatMinutes(summary.medianResolutionMins)}
          hint={`avg ${formatMinutes(summary.avgResolutionMins)}`}
          icon={<Gauge className="h-4 w-4" />}
          tone="neutral"
        />
        <StatTile
          label="Member satisfaction"
          value={summary.csatAverage !== null ? `${summary.csatAverage}/5` : '—'}
          hint={`${summary.csatResponses} rating${summary.csatResponses === 1 ? '' : 's'}`}
          icon={<ChangeIcon className="h-4 w-4" />}
          tone={
            summary.csatAverage === null ? 'neutral' : summary.csatAverage >= 4 ? 'success' : 'warning'
          }
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardBody>
            <VolumeChart data={analytics.volume} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="SLA compliance" description="Measured on decided tickets only" />
          <CardBody className="space-y-4">
            <Meter
              label="First response"
              percent={sla.firstResponseCompliance}
              caption={`${sla.firstResponseMeasured} ticket${sla.firstResponseMeasured === 1 ? '' : 's'} decided`}
              color={statusColor(complianceLevel(sla.firstResponseCompliance), dark)}
            />
            <Meter
              label="Resolution"
              percent={sla.resolutionCompliance}
              caption={`${sla.resolutionMeasured} ticket${sla.resolutionMeasured === 1 ? '' : 's'} decided`}
              color={statusColor(complianceLevel(sla.resolutionCompliance), dark)}
            />
            <p className="border-t border-line pt-3 text-xs leading-relaxed text-muted">
              A ticket is &ldquo;decided&rdquo; once it has been answered or its deadline has passed,
              so tickets still sitting past their target count as misses.
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardBody>
            <BarBreakdown
              data={breakdown.status}
              title="By status"
              formatLabel={titleCase}
              description="Where work currently sits"
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <BarBreakdown
              data={breakdown.priority}
              title="By priority"
              formatLabel={titleCase}
              description="Set by AI triage, adjustable by staff"
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <BarBreakdown
              data={breakdown.category}
              title="By category"
              formatLabel={titleCase}
              description="What members contact you about"
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <BarBreakdown
              data={breakdown.sentiment}
              title="Member sentiment"
              formatLabel={titleCase}
              description="Detected on arrival"
            />
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="AI triage effectiveness"
            icon={<Bot className="h-4 w-4" />}
            description="Every draft is reviewed by a human — these are the review outcomes"
          />
          <CardBody>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium text-muted">Acceptance rate</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
                  {ai.acceptanceRate === null ? '—' : `${ai.acceptanceRate}%`}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {ai.reviewed} draft{ai.reviewed === 1 ? '' : 's'} reviewed
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted">Sent unedited</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
                  {ai.verbatimRate === null ? '—' : `${ai.verbatimRate}%`}
                </p>
                <p className="mt-0.5 text-xs text-muted">Approved with no changes</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted">Awaiting review</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{ai.pending}</p>
                <p className="mt-0.5 text-xs text-muted">{ai.total} generated in range</p>
              </div>
            </div>

            <div className="mt-4 border-t border-line pt-4">
              <BarBreakdown
                data={[
                  { key: 'APPROVED', value: ai.approved },
                  { key: 'EDITED', value: ai.edited },
                  { key: 'REJECTED', value: ai.rejected },
                  { key: 'PENDING', value: ai.pending },
                ].filter((row) => row.value > 0)}
                title="Review outcomes"
                formatLabel={titleCase}
                emptyMessage="No AI drafts generated in this range."
              />
            </div>

            {ai.byEngine.length > 0 && (
              <div className="mt-4 border-t border-line pt-3">
                <p className="mb-2 text-xs font-medium text-muted">By engine</p>
                <ul className="space-y-1.5">
                  {ai.byEngine.map((engine) => (
                    <li
                      key={engine.engine}
                      className="flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <span className="text-ink">
                        {engine.engine === 'OPENAI' ? 'OpenAI' : 'Local engine'}
                      </span>
                      <span className="tabular-nums text-muted">
                        {engine.count} draft{engine.count === 1 ? '' : 's'} ·{' '}
                        {engine.avgConfidence !== null
                          ? `${Math.round(engine.avgConfidence * 100)}% avg confidence`
                          : 'no confidence data'}{' '}
                        · {engine.avgLatencyMs ?? '—'} ms
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardBody>
              <BarBreakdown
                data={breakdown.backlogAging}
                title="Backlog age"
                description="How long unresolved tickets have been open"
                formatLabel={(key) => key}
                emptyMessage="No open tickets."
              />
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <BarBreakdown
                data={analytics.escalations}
                title="Escalation reasons"
                description="Why tickets were escalated"
                formatLabel={titleCase}
                emptyMessage="No escalations in this range."
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

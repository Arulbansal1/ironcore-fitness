import 'server-only';

import { Prisma } from '@prisma/client';

import { prisma } from './prisma';

// Re-exported so server components can keep importing it from here.
export { formatMinutes } from './utils';

export type AnalyticsRange = 7 | 30 | 90;

export type Analytics = Awaited<ReturnType<typeof buildAnalytics>>;

/**
 * Aggregates everything the analytics dashboard shows in one pass.
 *
 * Time-series and percentile work is pushed into SQL rather than pulled into
 * Node — the ticket table is the one thing guaranteed to grow, and loading it
 * into memory to compute an average would stop working exactly when the metrics
 * start to matter.
 */
export async function buildAnalytics(rangeDays: AnalyticsRange = 30) {
  const since = new Date(Date.now() - rangeDays * 86_400_000);
  const previousSince = new Date(Date.now() - rangeDays * 2 * 86_400_000);

  const [
    totals,
    previousTotals,
    statusCounts,
    priorityCounts,
    categoryCounts,
    sentimentCounts,
    volumeSeries,
    responseStats,
    slaCompliance,
    agentPerformance,
    aiStats,
    aiByEngine,
    csat,
    escalationStats,
    topArticles,
    backlogAging,
  ] = await Promise.all([
    prisma.ticket.count({ where: { createdAt: { gte: since } } }),
    prisma.ticket.count({ where: { createdAt: { gte: previousSince, lt: since } } }),

    prisma.ticket.groupBy({
      by: ['status'],
      _count: true,
      where: { createdAt: { gte: since } },
    }),
    prisma.ticket.groupBy({
      by: ['priority'],
      _count: true,
      where: { createdAt: { gte: since } },
    }),
    prisma.ticket.groupBy({
      by: ['category'],
      _count: true,
      where: { createdAt: { gte: since } },
    }),
    prisma.ticket.groupBy({
      by: ['aiSentiment'],
      _count: true,
      where: { createdAt: { gte: since }, aiSentiment: { not: null } },
    }),

    // Daily volume, with resolved counts, gap-filled so the chart has no holes.
    prisma.$queryRaw<Array<{ day: Date; created: bigint; resolved: bigint }>>(Prisma.sql`
      WITH days AS (
        SELECT generate_series(
          date_trunc('day', ${since}::timestamptz),
          date_trunc('day', NOW()),
          '1 day'
        ) AS day
      )
      SELECT
        d.day,
        COUNT(DISTINCT t.id) FILTER (WHERE date_trunc('day', t."createdAt") = d.day) AS created,
        COUNT(DISTINCT r.id) FILTER (WHERE date_trunc('day', r."resolvedAt") = d.day) AS resolved
      FROM days d
      LEFT JOIN "Ticket" t ON date_trunc('day', t."createdAt") = d.day
      LEFT JOIN "Ticket" r ON date_trunc('day', r."resolvedAt") = d.day
      GROUP BY d.day
      ORDER BY d.day ASC
    `),

    // First-response and resolution times, in minutes.
    prisma.$queryRaw<
      Array<{
        avg_first_response: number | null;
        median_first_response: number | null;
        p90_first_response: number | null;
        avg_resolution: number | null;
        median_resolution: number | null;
      }>
    >(Prisma.sql`
      SELECT
        AVG(EXTRACT(EPOCH FROM ("firstRespondedAt" - "createdAt")) / 60)::float AS avg_first_response,
        PERCENTILE_CONT(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM ("firstRespondedAt" - "createdAt")) / 60
        )::float AS median_first_response,
        PERCENTILE_CONT(0.9) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM ("firstRespondedAt" - "createdAt")) / 60
        )::float AS p90_first_response,
        AVG(
          CASE WHEN "resolvedAt" IS NOT NULL
          THEN EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 60 END
        )::float AS avg_resolution,
        PERCENTILE_CONT(0.5) WITHIN GROUP (
          ORDER BY CASE WHEN "resolvedAt" IS NOT NULL
          THEN EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 60 END
        )::float AS median_resolution
      FROM "Ticket"
      WHERE "createdAt" >= ${since} AND "firstRespondedAt" IS NOT NULL
    `),

    // SLA compliance.
    //
    // A ticket counts as MEASURED once its outcome is decided: either it was
    // answered, or its deadline has passed. Counting only answered tickets would
    // silently exclude every outstanding breach and report a flattering number —
    // the ones still sitting unanswered past their deadline are exactly the
    // failures the metric exists to surface.
    prisma.$queryRaw<
      Array<{
        total: bigint;
        first_response_met: bigint;
        resolution_met: bigint;
        first_response_measured: bigint;
        resolution_measured: bigint;
      }>
    >(Prisma.sql`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (
          WHERE "firstRespondedAt" IS NOT NULL
            AND "firstResponseDue" IS NOT NULL
            AND "firstRespondedAt" <= "firstResponseDue"
        ) AS first_response_met,
        COUNT(*) FILTER (
          WHERE "resolvedAt" IS NOT NULL
            AND "resolutionDue" IS NOT NULL
            AND "resolvedAt" <= "resolutionDue"
        ) AS resolution_met,
        COUNT(*) FILTER (
          WHERE "firstResponseDue" IS NOT NULL
            AND ("firstRespondedAt" IS NOT NULL OR "firstResponseDue" < NOW())
        ) AS first_response_measured,
        COUNT(*) FILTER (
          WHERE "resolutionDue" IS NOT NULL
            AND ("resolvedAt" IS NOT NULL OR "resolutionDue" < NOW())
        ) AS resolution_measured
      FROM "Ticket"
      WHERE "createdAt" >= ${since}
    `),

    prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        avatarColor: string;
        assigned: bigint;
        resolved: bigint;
        avg_first_response: number | null;
        avg_csat: number | null;
        breaches: bigint;
      }>
    >(Prisma.sql`
      SELECT
        u."id",
        u."name",
        u."avatarColor",
        COUNT(t."id") AS assigned,
        COUNT(t."id") FILTER (WHERE t."status" IN ('RESOLVED', 'CLOSED')) AS resolved,
        AVG(
          CASE WHEN t."firstRespondedAt" IS NOT NULL
          THEN EXTRACT(EPOCH FROM (t."firstRespondedAt" - t."createdAt")) / 60 END
        )::float AS avg_first_response,
        AVG(t."satisfaction")::float AS avg_csat,
        COUNT(t."id") FILTER (
          WHERE t."firstResponseBreached" = true OR t."resolutionBreached" = true
        ) AS breaches
      FROM "User" u
      LEFT JOIN "Ticket" t ON t."assigneeId" = u."id" AND t."createdAt" >= ${since}
      WHERE u."role" IN ('STAFF', 'ADMIN') AND u."isActive" = true
      GROUP BY u."id", u."name", u."avatarColor"
      ORDER BY assigned DESC
    `),

    prisma.aiSuggestion.groupBy({
      by: ['status'],
      _count: true,
      where: { createdAt: { gte: since } },
    }),

    prisma.aiSuggestion.groupBy({
      by: ['engine'],
      _count: true,
      _avg: { confidence: true, latencyMs: true },
      where: { createdAt: { gte: since } },
    }),

    prisma.ticket.aggregate({
      where: { createdAt: { gte: since }, satisfaction: { not: null } },
      _avg: { satisfaction: true },
      _count: { satisfaction: true },
    }),

    prisma.escalation.groupBy({
      by: ['reason'],
      _count: true,
      where: { createdAt: { gte: since } },
    }),

    prisma.kbArticle.findMany({
      where: { isPublished: true },
      orderBy: { views: 'desc' },
      take: 5,
      select: { id: true, title: true, slug: true, views: true, category: true },
    }),

    // How long unresolved work has been sitting.
    prisma.$queryRaw<Array<{ bucket: string; count: bigint }>>(Prisma.sql`
      SELECT
        CASE
          WHEN NOW() - "createdAt" < INTERVAL '1 day'  THEN '< 1 day'
          WHEN NOW() - "createdAt" < INTERVAL '3 days' THEN '1-3 days'
          WHEN NOW() - "createdAt" < INTERVAL '7 days' THEN '3-7 days'
          ELSE '7+ days'
        END AS bucket,
        COUNT(*) AS count
      FROM "Ticket"
      WHERE "status" IN ('OPEN', 'IN_PROGRESS', 'PENDING_MEMBER')
      GROUP BY bucket
    `),
  ]);

  const response = responseStats[0] ?? {};
  const sla = slaCompliance[0];

  const firstResponseMeasured = Number(sla?.first_response_measured ?? 0);
  const resolutionMeasured = Number(sla?.resolution_measured ?? 0);

  const aiCounts = Object.fromEntries(aiStats.map((row) => [row.status, row._count]));
  const aiReviewed =
    (aiCounts.APPROVED ?? 0) + (aiCounts.EDITED ?? 0) + (aiCounts.REJECTED ?? 0);

  const bucketOrder = ['< 1 day', '1-3 days', '3-7 days', '7+ days'];

  return {
    rangeDays,
    generatedAt: new Date().toISOString(),

    summary: {
      created: totals,
      previousCreated: previousTotals,
      changePercent:
        previousTotals > 0
          ? Math.round(((totals - previousTotals) / previousTotals) * 100)
          : null,
      avgFirstResponseMins: round(response.avg_first_response),
      medianFirstResponseMins: round(response.median_first_response),
      p90FirstResponseMins: round(response.p90_first_response),
      avgResolutionMins: round(response.avg_resolution),
      medianResolutionMins: round(response.median_resolution),
      csatAverage: csat._avg.satisfaction ? Number(csat._avg.satisfaction.toFixed(2)) : null,
      csatResponses: csat._count.satisfaction,
    },

    sla: {
      firstResponseCompliance:
        firstResponseMeasured > 0
          ? Math.round((Number(sla.first_response_met) / firstResponseMeasured) * 100)
          : null,
      resolutionCompliance:
        resolutionMeasured > 0
          ? Math.round((Number(sla.resolution_met) / resolutionMeasured) * 100)
          : null,
      firstResponseMeasured,
      resolutionMeasured,
    },

    breakdown: {
      status: statusCounts.map((row) => ({ key: row.status, value: row._count })),
      priority: priorityCounts.map((row) => ({ key: row.priority, value: row._count })),
      category: categoryCounts.map((row) => ({ key: row.category, value: row._count })),
      sentiment: sentimentCounts.map((row) => ({ key: row.aiSentiment ?? 'UNKNOWN', value: row._count })),
      backlogAging: bucketOrder
        .map((bucket) => ({
          key: bucket,
          value: Number(backlogAging.find((row) => row.bucket === bucket)?.count ?? 0),
        }))
        .filter((row) => row.value > 0 || bucketOrder.includes(row.key)),
    },

    volume: volumeSeries.map((row) => ({
      date: row.day.toISOString().slice(0, 10),
      created: Number(row.created),
      resolved: Number(row.resolved),
    })),

    staff: agentPerformance.map((row) => ({
      id: row.id,
      name: row.name,
      avatarColor: row.avatarColor,
      assigned: Number(row.assigned),
      resolved: Number(row.resolved),
      avgFirstResponseMins: round(row.avg_first_response),
      avgCsat: row.avg_csat ? Number(row.avg_csat.toFixed(2)) : null,
      breaches: Number(row.breaches),
    })),

    ai: {
      total: Object.values(aiCounts).reduce((sum, value) => sum + value, 0),
      pending: aiCounts.PENDING ?? 0,
      approved: aiCounts.APPROVED ?? 0,
      edited: aiCounts.EDITED ?? 0,
      rejected: aiCounts.REJECTED ?? 0,
      reviewed: aiReviewed,
      acceptanceRate:
        aiReviewed > 0
          ? Math.round((((aiCounts.APPROVED ?? 0) + (aiCounts.EDITED ?? 0)) / aiReviewed) * 100)
          : null,
      // How often an approved draft went out unchanged — the honest measure of
      // whether the AI is actually saving the team time.
      verbatimRate:
        aiReviewed > 0 ? Math.round(((aiCounts.APPROVED ?? 0) / aiReviewed) * 100) : null,
      byEngine: aiByEngine.map((row) => ({
        engine: row.engine,
        count: row._count,
        avgConfidence: row._avg.confidence ? Number(row._avg.confidence.toFixed(2)) : null,
        avgLatencyMs: row._avg.latencyMs ? Math.round(row._avg.latencyMs) : null,
      })),
    },

    escalations: escalationStats.map((row) => ({ key: row.reason, value: row._count })),

    topArticles,
  };
}

function round(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.round(value);
}

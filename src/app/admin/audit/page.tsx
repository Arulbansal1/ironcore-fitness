import { History } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHeader } from '@/components/layout/AppShell';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { Pagination } from '@/components/ui/Pagination';
import { prisma } from '@/lib/prisma';
import { cn, formatDateTime, initials, relativeTime } from '@/lib/utils';

export const metadata: Metadata = { title: 'Audit log' };
export const dynamic = 'force-dynamic';

const ACTION_TONE: Array<[RegExp, string]> = [
  [/^auth\.login_failed/, 'text-amber-600 dark:text-amber-400'],
  [/^auth\./, 'text-sky-600 dark:text-sky-400'],
  [/^sla\./, 'text-red-600 dark:text-red-400'],
  [/^escalation\./, 'text-red-600 dark:text-red-400'],
  [/^ai\./, 'text-violet-600 dark:text-violet-400'],
  [/^kb\./, 'text-emerald-600 dark:text-emerald-400'],
  [/^admin\./, 'text-brand-600'],
  [/^payment\./, 'text-amber-600 dark:text-amber-400'],
];

function actionClass(action: string) {
  return ACTION_TONE.find(([pattern]) => pattern.test(action))?.[1] ?? 'text-muted';
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; entityType?: string; page?: string; search?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(Number(params.page) || 1, 1);
  const pageSize = 50;

  const where = {
    ...(params.action && params.action !== 'ALL' ? { action: params.action } : {}),
    ...(params.entityType && params.entityType !== 'ALL' ? { entityType: params.entityType } : {}),
    ...(params.search
      ? {
          OR: [
            { detail: { contains: params.search, mode: 'insensitive' as const } },
            { actorEmail: { contains: params.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [logs, total, entityTypes] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { actor: { select: { name: true, role: true, avatarColor: true } } },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({ by: ['entityType'], _count: true, orderBy: { entityType: 'asc' } }),
  ]);

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { ...params, ...overrides, page: undefined };
    for (const [key, value] of Object.entries(merged)) {
      if (value && value !== 'ALL') next.set(key, value);
    }
    const query = next.toString();
    return query ? `/admin/audit?${query}` : '/admin/audit';
  };

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Append-only record of every privileged action, authentication event and automated decision."
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link
          href={buildHref({ entityType: undefined })}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
            !params.entityType || params.entityType === 'ALL'
              ? 'border-brand-500 bg-brand-50 text-brand-700'
              : 'border-line text-muted hover:text-ink',
          )}
        >
          All ({total})
        </Link>
        {entityTypes.map((entity) => (
          <Link
            key={entity.entityType}
            href={buildHref({ entityType: entity.entityType })}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              params.entityType === entity.entityType
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-line text-muted hover:text-ink',
            )}
          >
            {entity.entityType} ({entity._count})
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader
          title={`${total} recorded event${total === 1 ? '' : 's'}`}
          description={`Page ${page} of ${Math.max(1, Math.ceil(total / pageSize))}`}
          icon={<History className="h-4 w-4" />}
        />

        {logs.length === 0 ? (
          <EmptyState
            icon={<History className="h-5 w-5" />}
            title="No audit entries match"
            description="Try clearing the filters."
          />
        ) : (
          <>
            <ul className="divide-y divide-line">
              {logs.map((log) => (
                <li key={log.id} className="flex flex-wrap items-start gap-3 px-4 py-3 sm:px-5">
                  <span
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                    style={{ backgroundColor: log.actor?.avatarColor ?? '#64748b' }}
                    aria-hidden
                  >
                    {log.actor ? initials(log.actor.name) : 'SYS'}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <code
                        className={cn(
                          'rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs font-medium',
                          actionClass(log.action),
                        )}
                      >
                        {log.action}
                      </code>
                      <span className="text-xs text-muted">
                        {log.actor?.name ?? log.actorEmail ?? 'system'}
                        {log.actor?.role && ` (${log.actor.role.toLowerCase()})`}
                      </span>
                    </p>

                    {log.detail && <p className="mt-1 text-sm leading-relaxed text-ink">{log.detail}</p>}

                    <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted">
                      <span>{log.entityType}</span>
                      {log.entityId && <span className="font-mono">{log.entityId.slice(-8)}</span>}
                      {log.ip && <span>IP {log.ip}</span>}
                      <time dateTime={log.createdAt.toISOString()} title={formatDateTime(log.createdAt)}>
                        {relativeTime(log.createdAt)}
                      </time>
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <Pagination
              pagination={{
                page,
                pageSize,
                total,
                totalPages: Math.max(1, Math.ceil(total / pageSize)),
              }}
            />
          </>
        )}
      </Card>
    </>
  );
}

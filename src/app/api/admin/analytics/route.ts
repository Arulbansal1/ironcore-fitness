import { requireUser } from '@/lib/auth';
import { buildAnalytics, type AnalyticsRange } from '@/lib/analytics';
import { ok, route } from '@/lib/http';

export const dynamic = 'force-dynamic';

export const GET = route(async (request: Request) => {
  await requireUser(['ADMIN']);

  const raw = Number(new URL(request.url).searchParams.get('range'));
  const range: AnalyticsRange = raw === 7 || raw === 90 ? raw : 30;

  return ok(await buildAnalytics(range));
});

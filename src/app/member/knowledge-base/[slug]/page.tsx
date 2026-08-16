import { ArrowLeft, Eye, PlusCircle } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CategoryBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { prisma } from '@/lib/prisma';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await prisma.kbArticle.findUnique({ where: { slug }, select: { title: true } });
  return { title: article?.title ?? 'Article' };
}

export default async function KbArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const article = await prisma.kbArticle.findUnique({ where: { slug } });
  if (!article || !article.isPublished) notFound();

  // Fire-and-forget view counter.
  prisma.kbArticle
    .update({ where: { id: article.id }, data: { views: { increment: 1 } } })
    .catch(() => undefined);

  const related = await prisma.kbArticle.findMany({
    where: { category: article.category, isPublished: true, id: { not: article.id } },
    orderBy: { views: 'desc' },
    take: 3,
    select: { id: true, title: true, slug: true, summary: true },
  });

  return (
    <>
      <Link
        href="/member/knowledge-base"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to help centre
      </Link>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardBody className="sm:px-7 sm:py-6">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge category={article.category} />
              <span className="inline-flex items-center gap-1 text-xs text-muted">
                <Eye className="h-3.5 w-3.5" aria-hidden />
                {article.views} views
              </span>
              <span className="text-xs text-muted">Updated {formatDate(article.updatedAt)}</span>
            </div>

            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">{article.title}</h1>
            <p className="mt-2 text-base leading-relaxed text-muted">{article.summary}</p>

            <div className="mt-6 space-y-4 border-t border-line pt-6">
              {article.content.split(/\n{2,}/).map((paragraph, index) => (
                <p key={index} className="text-[15px] leading-relaxed text-ink">
                  {paragraph}
                </p>
              ))}
            </div>

            {article.tags.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-1.5 border-t border-line pt-4">
                {article.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Still stuck?" description="Open a ticket and we'll take it from here." />
            <CardBody>
              <Link href="/member/tickets/new">
                <Button fullWidth>
                  <PlusCircle className="h-4 w-4" aria-hidden />
                  Contact support
                </Button>
              </Link>
            </CardBody>
          </Card>

          {related.length > 0 && (
            <Card>
              <CardHeader title="Related articles" />
              <CardBody className="space-y-2.5">
                {related.map((item) => (
                  <Link
                    key={item.id}
                    href={`/member/knowledge-base/${item.slug}`}
                    className="block rounded-lg border border-line p-3 transition-colors hover:border-brand-500/60 hover:bg-surface-2/50"
                  >
                    <p className="text-sm font-medium text-ink">{item.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted">{item.summary}</p>
                  </Link>
                ))}
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

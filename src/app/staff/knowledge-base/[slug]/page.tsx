import { ArrowLeft, Eye } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CategoryBadge } from '@/components/ui/Badge';
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

export default async function StaffKbArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const article = await prisma.kbArticle.findUnique({
    where: { slug },
    include: {
      author: { select: { name: true } },
      _count: { select: { chunks: true } },
    },
  });
  if (!article) notFound();

  const related = await prisma.kbArticle.findMany({
    where: { category: article.category, id: { not: article.id }, isPublished: true },
    orderBy: { views: 'desc' },
    take: 4,
    select: { id: true, title: true, slug: true, summary: true },
  });

  return (
    <>
      <Link
        href="/staff/knowledge-base"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to knowledge base
      </Link>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardBody className="sm:px-7 sm:py-6">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge category={article.category} />
              {!article.isPublished && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                  Draft — not visible to members
                </span>
              )}
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
            <CardHeader title="Article metadata" description="How this article is indexed for RAG" />
            <CardBody className="space-y-2 text-sm">
              <Row label="Author" value={article.author?.name ?? 'Unknown'} />
              <Row label="Slug" value={article.slug} mono />
              <Row label="Vector chunks" value={String(article._count.chunks)} />
              <Row label="Published" value={article.isPublished ? 'Yes' : 'No'} />
              <Row label="Created" value={formatDate(article.createdAt)} />
            </CardBody>
          </Card>

          {related.length > 0 && (
            <Card>
              <CardHeader title="Related articles" />
              <CardBody className="space-y-2.5">
                {related.map((item) => (
                  <Link
                    key={item.id}
                    href={`/staff/knowledge-base/${item.slug}`}
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

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-xs text-muted">{label}</span>
      <span className={`min-w-0 break-all text-right text-sm text-ink ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
    </div>
  );
}

import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/AppShell';
import { prisma } from '@/lib/prisma';
import { vectorIndexStats } from '@/lib/rag';
import { activeEmbeddingModel } from '@/lib/ai';

import { KbManager } from './KbManager';

export const metadata: Metadata = { title: 'Knowledge base' };
export const dynamic = 'force-dynamic';

export default async function AdminKnowledgeBasePage() {
  const [articles, stats] = await Promise.all([
    prisma.kbArticle.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        author: { select: { name: true } },
        _count: { select: { chunks: true } },
      },
    }),
    vectorIndexStats(),
  ]);

  return (
    <>
      <PageHeader
        title="Knowledge base"
        description="Articles here are chunked, embedded and retrieved to ground every AI reply draft."
      />

      <KbManager
        embeddingModel={activeEmbeddingModel()}
        stats={stats}
        articles={articles.map((article) => ({
          id: article.id,
          title: article.title,
          slug: article.slug,
          summary: article.summary,
          category: article.category,
          tags: article.tags,
          isPublished: article.isPublished,
          views: article.views,
          chunkCount: article._count.chunks,
          authorName: article.author?.name ?? null,
          updatedAt: article.updatedAt.toISOString(),
        }))}
      />
    </>
  );
}

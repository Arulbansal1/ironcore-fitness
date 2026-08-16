import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/layout/AppShell';
import { prisma } from '@/lib/prisma';

import { ArticleEditor } from '../ArticleEditor';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const article = await prisma.kbArticle.findUnique({ where: { id }, select: { title: true } });
  return { title: article ? `Edit — ${article.title}` : 'Edit article' };
}

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const article = await prisma.kbArticle.findUnique({
    where: { id },
    include: { _count: { select: { chunks: true } } },
  });
  if (!article) notFound();

  return (
    <>
      <PageHeader
        title="Edit article"
        description="Content changes re-embed the article so retrieval stays in sync with the text."
      />
      <ArticleEditor
        initial={{
          id: article.id,
          title: article.title,
          summary: article.summary,
          content: article.content,
          category: article.category,
          tags: article.tags,
          isPublished: article.isPublished,
          slug: article.slug,
          chunkCount: article._count.chunks,
        }}
      />
    </>
  );
}

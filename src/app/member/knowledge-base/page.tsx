import { BookOpen } from 'lucide-react';
import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/AppShell';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { prisma } from '@/lib/prisma';

import { KbBrowser } from './KbBrowser';

export const metadata: Metadata = { title: 'Help centre' };
export const dynamic = 'force-dynamic';

export default async function MemberKnowledgeBasePage() {
  const articles = await prisma.kbArticle.findMany({
    where: { isPublished: true },
    orderBy: [{ category: 'asc' }, { views: 'desc' }],
    select: {
      id: true,
      title: true,
      slug: true,
      summary: true,
      category: true,
      tags: true,
      views: true,
      updatedAt: true,
    },
  });

  return (
    <>
      <PageHeader
        title="Help centre"
        description="Search our knowledge base — the same articles our AI uses to draft replies."
      />

      {articles.length === 0 ? (
        <Card>
          <CardHeader title="Knowledge base" />
          <EmptyState
            icon={<BookOpen className="h-5 w-5" />}
            title="No articles published yet"
            description="An administrator has not published any help articles."
          />
        </Card>
      ) : (
        <KbBrowser
          articles={articles.map((article) => ({
            ...article,
            updatedAt: article.updatedAt.toISOString(),
          }))}
          basePath="/member/knowledge-base"
        />
      )}
    </>
  );
}

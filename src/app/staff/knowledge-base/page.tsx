import { BookOpen } from 'lucide-react';
import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/AppShell';
import { KbBrowser } from '@/app/member/knowledge-base/KbBrowser';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { prisma } from '@/lib/prisma';

export const metadata: Metadata = { title: 'Knowledge base' };
export const dynamic = 'force-dynamic';

export default async function StaffKnowledgeBasePage() {
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
        title="Knowledge base"
        description="The same corpus that grounds AI reply drafts. Search it semantically before answering."
      />

      {articles.length === 0 ? (
        <Card>
          <CardHeader title="Knowledge base" />
          <EmptyState
            icon={<BookOpen className="h-5 w-5" />}
            title="No articles published"
            description="Ask an administrator to publish articles so AI drafts have something to cite."
          />
        </Card>
      ) : (
        <KbBrowser
          articles={articles.map((article) => ({
            ...article,
            updatedAt: article.updatedAt.toISOString(),
          }))}
          basePath="/staff/knowledge-base"
        />
      )}
    </>
  );
}

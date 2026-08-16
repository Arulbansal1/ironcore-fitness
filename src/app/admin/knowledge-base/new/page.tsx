import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/AppShell';

import { ArticleEditor } from '../ArticleEditor';

export const metadata: Metadata = { title: 'New article' };

export default function NewArticlePage() {
  return (
    <>
      <PageHeader
        title="New knowledge base article"
        description="Saving chunks and embeds the article so AI reply drafts can cite it immediately."
      />
      <ArticleEditor
        initial={{
          title: '',
          summary: '',
          content: '',
          category: 'GENERAL',
          tags: [],
          isPublished: true,
        }}
      />
    </>
  );
}

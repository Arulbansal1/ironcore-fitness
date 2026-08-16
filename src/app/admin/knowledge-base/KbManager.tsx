'use client';

import { BookOpen, Layers, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge, CategoryBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Modal';
import { StatTile } from '@/components/ui/StatTile';
import { useToast } from '@/components/ui/Toast';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { cn, relativeTime } from '@/lib/utils';

type Article = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  category: string;
  tags: string[];
  isPublished: boolean;
  views: number;
  chunkCount: number;
  authorName: string | null;
  updatedAt: string;
};

export function KbManager({
  articles,
  stats,
  embeddingModel,
}: {
  articles: Article[];
  stats: { articles: number; published: number; chunks: number };
  embeddingModel: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Article | null>(null);

  const term = search.trim().toLowerCase();
  const filtered = term
    ? articles.filter(
        (article) =>
          article.title.toLowerCase().includes(term) ||
          article.summary.toLowerCase().includes(term) ||
          article.tags.some((tag) => tag.toLowerCase().includes(term)),
      )
    : articles;

  const unindexed = articles.filter((a) => a.chunkCount === 0 && a.isPublished);

  async function reindex(article: Article) {
    setBusy(article.id);
    try {
      const result = await apiFetch<{ message: string }>(`/api/kb/${article.id}`, { method: 'POST' });
      toast.success(result.message);
      router.refresh();
    } catch (caught) {
      toast.error('Re-embedding failed', errorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  async function togglePublish(article: Article) {
    setBusy(article.id);
    try {
      await apiFetch(`/api/kb/${article.id}`, {
        method: 'PATCH',
        body: { isPublished: !article.isPublished },
      });
      toast.success(article.isPublished ? 'Article unpublished.' : 'Article published.');
      router.refresh();
    } catch (caught) {
      toast.error('Could not update the article', errorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  async function remove(article: Article) {
    setBusy(article.id);
    try {
      await apiFetch(`/api/kb/${article.id}`, { method: 'DELETE' });
      toast.success(`"${article.title}" deleted.`);
      setConfirmDelete(null);
      router.refresh();
    } catch (caught) {
      toast.error('Could not delete the article', errorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Articles"
          value={stats.articles}
          hint={`${stats.published} published`}
          icon={<BookOpen className="h-4 w-4" />}
          tone="brand"
        />
        <StatTile
          label="Vector chunks"
          value={stats.chunks}
          hint="Retrievable passages for RAG"
          icon={<Layers className="h-4 w-4" />}
        />
        <StatTile
          label="Embedding model"
          value={<span className="text-base">{embeddingModel}</span>}
          hint={
            embeddingModel.startsWith('local')
              ? 'Set OPENAI_API_KEY for semantic embeddings'
              : 'Semantic embeddings active'
          }
          tone={embeddingModel.startsWith('local') ? 'warning' : 'success'}
        />
      </div>

      {unindexed.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          {unindexed.length} published article{unindexed.length === 1 ? ' has' : 's have'} no
          embeddings and cannot be retrieved by the AI. Use <strong>Reindex</strong> on each.
        </div>
      )}

      <div className="mt-5 mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search articles by title, summary or tag…"
            aria-label="Search articles"
            className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-ink"
          />
        </div>
        <Link href="/admin/knowledge-base/new">
          <Button>
            <Plus className="h-4 w-4" aria-hidden />
            New article
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader
          title={`${filtered.length} article${filtered.length === 1 ? '' : 's'}`}
          description="Editing the text automatically re-embeds the article"
        />

        {filtered.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-5 w-5" />}
            title={articles.length === 0 ? 'No articles yet' : 'No articles match'}
            description={
              articles.length === 0
                ? 'Write your first article so AI drafts have grounded material to cite.'
                : 'Try a different search term.'
            }
            action={
              articles.length === 0 ? (
                <Link href="/admin/knowledge-base/new">
                  <Button size="sm">Create an article</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {filtered.map((article) => (
              <li key={article.id} className="px-4 py-3.5 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/knowledge-base/${article.id}`}
                      className="text-sm font-semibold text-ink hover:text-brand-600"
                    >
                      {article.title}
                    </Link>
                    <p className="mt-0.5 line-clamp-2 text-sm leading-relaxed text-muted">
                      {article.summary}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <CategoryBadge category={article.category} />
                      <Badge tone={article.isPublished ? 'success' : 'neutral'} dot>
                        {article.isPublished ? 'Published' : 'Draft'}
                      </Badge>
                      <Badge tone={article.chunkCount > 0 ? 'info' : 'danger'}>
                        {article.chunkCount} chunk{article.chunkCount === 1 ? '' : 's'}
                      </Badge>
                      {article.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>

                    <p className="mt-1.5 text-xs text-muted">
                      {article.views} views · {article.authorName ?? 'Unknown author'} · updated{' '}
                      {relativeTime(article.updatedAt)}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    <Link href={`/admin/knowledge-base/${article.id}`}>
                      <Button size="sm" variant="outline">
                        Edit
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={busy === article.id}
                      onClick={() => reindex(article)}
                      title="Re-chunk and re-embed this article"
                    >
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                      Reindex
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={busy === article.id}
                      onClick={() => togglePublish(article)}
                    >
                      {article.isPublished ? 'Unpublish' : 'Publish'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmDelete(article)}
                      className={cn('text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10')}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && remove(confirmDelete)}
        title="Delete this article?"
        message={`"${confirmDelete?.title}" and its ${confirmDelete?.chunkCount ?? 0} embedded chunk(s) will be permanently removed. AI drafts will no longer be able to cite it.`}
        confirmLabel="Delete permanently"
        loading={busy === confirmDelete?.id}
      />
    </>
  );
}

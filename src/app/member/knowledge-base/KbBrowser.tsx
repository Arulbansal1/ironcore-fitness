'use client';

import { BookOpen, Loader2, Search, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Badge, CategoryBadge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader, EmptyState } from '@/components/ui/Card';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { TICKET_CATEGORIES } from '@/lib/constants';
import { cn, relativeTime } from '@/lib/utils';

type Article = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  category: string;
  tags: string[];
  views: number;
  updatedAt: string;
};

type SearchHit = {
  articleId: string;
  title: string;
  slug: string;
  summary: string;
  similarity: number;
};

/**
 * Knowledge base browser with two modes:
 *  - keyword-free browsing grouped by category
 *  - semantic search over pgvector embeddings (same retrieval the AI uses)
 */
export function KbBrowser({ articles, basePath }: { articles: Article[]; basePath: string }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setHits(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setSearching(true);

    const timer = setTimeout(async () => {
      try {
        const data = await apiFetch<{ results: SearchHit[] }>(
          `/api/kb/search?query=${encodeURIComponent(trimmed)}&limit=8`,
          { signal: controller.signal },
        );
        setHits(data.results);
        setError(null);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === 'AbortError') return;
        setError(errorMessage(caught, 'Search failed.'));
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const filtered = category ? articles.filter((a) => a.category === category) : articles;

  const grouped = filtered.reduce<Record<string, Article[]>>((acc, article) => {
    (acc[article.category] ??= []).push(article);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Describe your problem in your own words — semantic search, not keywords…"
            aria-label="Search the knowledge base"
            className="h-11 w-full rounded-lg border border-line bg-surface pl-9 pr-10 text-sm text-ink placeholder:text-muted/70"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted" aria-hidden />
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCategory('')}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              category === '' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line text-muted hover:text-ink',
            )}
          >
            All ({articles.length})
          </button>
          {TICKET_CATEGORIES.map((option) => {
            const count = articles.filter((a) => a.category === option.value).length;
            if (count === 0) return null;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setCategory(option.value)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  category === option.value
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-line text-muted hover:text-ink',
                )}
              >
                {option.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {hits ? (
        <Card>
          <CardHeader
            title={`${hits.length} semantic match${hits.length === 1 ? '' : 'es'}`}
            icon={<Sparkles className="h-4 w-4" />}
            description="Ranked by vector similarity — the same retrieval that grounds AI reply drafts"
          />
          {hits.length === 0 ? (
            <EmptyState
              icon={<Search className="h-5 w-5" />}
              title="Nothing matched"
              description="Try describing the problem differently, or open a ticket and a staff will help."
            />
          ) : (
            <ul className="divide-y divide-line">
              {hits.map((hit) => (
                <li key={hit.articleId}>
                  <Link
                    href={`${basePath}/${hit.slug}`}
                    className="block px-4 py-3.5 transition-colors hover:bg-surface-2/60 sm:px-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-ink">{hit.title}</p>
                      <Badge tone={hit.similarity > 0.5 ? 'success' : hit.similarity > 0.25 ? 'info' : 'neutral'}>
                        {Math.round(hit.similarity * 100)}% match
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">{hit.summary}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        Object.entries(grouped).map(([groupCategory, groupArticles]) => (
          <Card key={groupCategory}>
            <CardHeader
              title={
                TICKET_CATEGORIES.find((c) => c.value === groupCategory)?.label ?? groupCategory
              }
              icon={<BookOpen className="h-4 w-4" />}
              description={`${groupArticles.length} article${groupArticles.length === 1 ? '' : 's'}`}
            />
            <CardBody className="grid gap-2.5 sm:grid-cols-2">
              {groupArticles.map((article) => (
                <Link
                  key={article.id}
                  href={`${basePath}/${article.slug}`}
                  className="rounded-lg border border-line p-3.5 transition-colors hover:border-brand-500/60 hover:bg-surface-2/50"
                >
                  <p className="text-sm font-medium text-ink">{article.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{article.summary}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <CategoryBadge category={article.category} />
                    <span className="text-[11px] text-muted">
                      {article.views} views · updated {relativeTime(article.updatedAt)}
                    </span>
                  </div>
                </Link>
              ))}
            </CardBody>
          </Card>
        ))
      )}
    </div>
  );
}

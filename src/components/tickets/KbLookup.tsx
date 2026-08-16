'use client';

import { BookOpen, ChevronDown, Copy, Loader2, Search } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { cn } from '@/lib/utils';

type Hit = {
  articleId: string;
  title: string;
  slug: string;
  excerpt: string;
  similarity: number;
};

/**
 * Inline knowledge base lookup for staff — pre-seeded with the ticket text so
 * the relevant articles are one click away while writing a reply.
 */
export function KbLookup({ initialQuery }: { initialQuery: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const search = useCallback(async (term: string) => {
    if (term.trim().length < 3) {
      setHits([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ results: Hit[] }>(
        `/api/kb/search?query=${encodeURIComponent(term.trim().slice(0, 300))}&limit=5`,
      );
      setHits(data.results);
    } catch (caught) {
      setError(errorMessage(caught, 'Knowledge base search failed.'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Run the initial ticket-based lookup once the panel is opened.
  useEffect(() => {
    if (open && hits.length === 0 && !loading) search(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function copyExcerpt(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Excerpt copied to clipboard.');
    } catch {
      toast.error('Could not copy', 'Your browser blocked clipboard access.');
    }
  }

  return (
    <Card>
      <CardHeader
        title="Knowledge base lookup"
        icon={<BookOpen className="h-4 w-4" />}
        description="Hybrid vector + full-text search across published articles"
        action={
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
          >
            {open ? 'Hide' : 'Search'}
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
          </button>
        }
      />

      {open && (
        <CardBody className="space-y-3">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              search(query);
            }}
            className="relative"
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search the knowledge base…"
              aria-label="Search the knowledge base"
              className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-10 text-sm text-ink"
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted" aria-hidden />
            )}
          </form>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {!loading && hits.length === 0 && !error && (
            <p className="py-4 text-center text-sm text-muted">
              No matching articles. Try different wording.
            </p>
          )}

          <ul className="space-y-2">
            {hits.map((hit) => (
              <li key={hit.articleId} className="rounded-lg border border-line">
                <div className="flex items-start justify-between gap-2 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === hit.articleId ? null : hit.articleId)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-ink">{hit.title}</span>
                      <Badge tone={hit.similarity > 0.4 ? 'success' : hit.similarity > 0.2 ? 'info' : 'neutral'}>
                        {Math.round(hit.similarity * 100)}%
                      </Badge>
                    </span>
                  </button>
                  <Link
                    href={`/staff/knowledge-base/${hit.slug}`}
                    target="_blank"
                    className="shrink-0 text-xs font-medium text-brand-600 hover:underline"
                  >
                    Open
                  </Link>
                </div>

                {expanded === hit.articleId && (
                  <div className="border-t border-line px-3 py-2.5">
                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted">{hit.excerpt}</p>
                    <button
                      type="button"
                      onClick={() => copyExcerpt(hit.excerpt)}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                    >
                      <Copy className="h-3 w-3" aria-hidden />
                      Copy excerpt
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </CardBody>
      )}
    </Card>
  );
}

'use client';

import {
  BookOpen,
  Check,
  ChevronDown,
  Cpu,
  Pencil,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Badge, ConfidenceBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, EmptyState } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { cn, relativeTime } from '@/lib/utils';

export type Citation = {
  articleId: string;
  title: string;
  slug: string;
  similarity: number;
  used: boolean;
};

export type AiSuggestion = {
  id: string;
  draft: string;
  finalText: string | null;
  confidence: number;
  engine: 'OPENAI' | 'LOCAL_FALLBACK';
  model: string;
  status: 'PENDING' | 'APPROVED' | 'EDITED' | 'REJECTED';
  citations: unknown;
  reviewedAt: string | null;
  latencyMs: number | null;
  createdAt: string;
  reviewedBy: { id: string; name: string } | null;
};

const STATUS_TONE = {
  PENDING: 'info',
  APPROVED: 'success',
  EDITED: 'brand',
  REJECTED: 'neutral',
} as const;

function parseCitations(value: unknown): Citation[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Citation =>
      typeof item === 'object' && item !== null && 'articleId' in item && 'title' in item,
  );
}

/**
 * Staff-facing review of an AI-drafted reply.
 * Nothing here sends anything to the member: approving loads the text into the
 * reply composer, where the staff still has to press send.
 */
export function AiDraftPanel({
  ticketId,
  suggestions: initialSuggestions,
  onUseDraft,
  kbBasePath = '/staff/knowledge-base',
}: {
  ticketId: string;
  suggestions: AiSuggestion[];
  onUseDraft: (text: string, suggestionId: string) => void;
  kbBasePath?: string;
}) {
  const toast = useToast();
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const latest = suggestions[0] ?? null;
  const history = suggestions.slice(1);

  async function regenerate() {
    setGenerating(true);
    try {
      const result = await apiFetch<{ suggestion: AiSuggestion }>(`/api/tickets/${ticketId}/suggest`, {
        method: 'POST',
      });
      setSuggestions((current) => [result.suggestion, ...current]);
      toast.success('New draft generated.');
    } catch (caught) {
      toast.error('Could not generate a draft', errorMessage(caught));
    } finally {
      setGenerating(false);
    }
  }

  async function review(suggestion: AiSuggestion, action: 'approve' | 'edit' | 'reject') {
    setBusy(suggestion.id);
    try {
      const result = await apiFetch<{ message: string; suggestion: AiSuggestion }>(
        `/api/suggestions/${suggestion.id}`,
        {
          method: 'PATCH',
          body: { action, finalText: action === 'edit' ? editText : undefined },
        },
      );

      setSuggestions((current) =>
        current.map((item) => (item.id === suggestion.id ? result.suggestion : item)),
      );
      setEditing(null);

      if (action !== 'reject') {
        onUseDraft(result.suggestion.finalText ?? result.suggestion.draft, suggestion.id);
      }

      toast.success(result.message);
    } catch (caught) {
      toast.error('Review failed', errorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader
        title="AI reply draft"
        icon={<Sparkles className="h-4 w-4" />}
        description="Grounded in the knowledge base — review before sending"
        action={
          <Button size="sm" variant="outline" loading={generating} onClick={regenerate}>
            {!generating && <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
            Regenerate
          </Button>
        }
      />

      {!latest ? (
        <EmptyState
          icon={<Sparkles className="h-5 w-5" />}
          title="No draft yet"
          description="Generate a suggested reply grounded in your knowledge base."
          action={
            <Button size="sm" loading={generating} onClick={regenerate}>
              Generate draft
            </Button>
          }
        />
      ) : (
        <CardBody className="space-y-3.5">
          <DraftBody
            suggestion={latest}
            editing={editing === latest.id}
            editText={editText}
            setEditText={setEditText}
            onStartEdit={() => {
              setEditing(latest.id);
              setEditText(latest.finalText ?? latest.draft);
            }}
            onCancelEdit={() => setEditing(null)}
            onReview={(action) => review(latest, action)}
            onReuse={() => onUseDraft(latest.finalText ?? latest.draft, latest.id)}
            busy={busy === latest.id}
            kbBasePath={kbBasePath}
          />

          {history.length > 0 && (
            <div className="border-t border-line pt-3">
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-ink"
              >
                <ChevronDown
                  className={cn('h-3.5 w-3.5 transition-transform', showHistory && 'rotate-180')}
                  aria-hidden
                />
                {showHistory ? 'Hide' : 'Show'} {history.length} earlier draft
                {history.length === 1 ? '' : 's'}
              </button>

              {showHistory && (
                <div className="mt-3 space-y-3">
                  {history.map((item) => (
                    <div key={item.id} className="rounded-lg border border-line bg-surface-2/40 p-3">
                      <div className="mb-2 flex flex-wrap items-center gap-1.5">
                        <Badge tone={STATUS_TONE[item.status]}>{item.status.toLowerCase()}</Badge>
                        <ConfidenceBadge value={item.confidence} />
                        <span className="text-[11px] text-muted">{relativeTime(item.createdAt)}</span>
                        {item.reviewedBy && (
                          <span className="text-[11px] text-muted">by {item.reviewedBy.name}</span>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted">
                        {item.finalText ?? item.draft}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardBody>
      )}
    </Card>
  );
}

function DraftBody({
  suggestion,
  editing,
  editText,
  setEditText,
  onStartEdit,
  onCancelEdit,
  onReview,
  onReuse,
  busy,
  kbBasePath,
}: {
  suggestion: AiSuggestion;
  editing: boolean;
  editText: string;
  setEditText: (value: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onReview: (action: 'approve' | 'edit' | 'reject') => void;
  onReuse: () => void;
  busy: boolean;
  kbBasePath: string;
}) {
  const citations = parseCitations(suggestion.citations);
  const used = citations.filter((c) => c.used);
  const isPending = suggestion.status === 'PENDING';
  const lowConfidence = suggestion.confidence < 0.5;

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={STATUS_TONE[suggestion.status]}>{suggestion.status.toLowerCase()}</Badge>
        <ConfidenceBadge value={suggestion.confidence} />
        <Badge tone={suggestion.engine === 'OPENAI' ? 'purple' : 'neutral'}>
          <Cpu className="h-3 w-3" aria-hidden />
          {suggestion.model}
        </Badge>
        {suggestion.latencyMs !== null && (
          <span className="text-[11px] text-muted">{suggestion.latencyMs} ms</span>
        )}
        <span className="text-[11px] text-muted">{relativeTime(suggestion.createdAt)}</span>
      </div>

      {lowConfidence && isPending && (
        <Alert tone="warning" title="Low confidence">
          The knowledge base did not cover this question well. Verify every factual claim before
          sending, or reject the draft and answer manually.
        </Alert>
      )}

      {editing ? (
        <textarea
          value={editText}
          onChange={(event) => setEditText(event.target.value)}
          rows={10}
          aria-label="Edit AI draft"
          className="w-full resize-y rounded-lg border border-brand-500 bg-surface px-3 py-2.5 text-sm leading-relaxed text-ink"
        />
      ) : (
        <div className="whitespace-pre-wrap rounded-lg border border-line bg-surface-2/50 px-3.5 py-3 text-sm leading-relaxed text-ink">
          {suggestion.finalText ?? suggestion.draft}
        </div>
      )}

      {citations.length > 0 && (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">
            <BookOpen className="h-3.5 w-3.5" aria-hidden />
            Retrieved sources ({used.length} used of {citations.length})
          </p>
          <ul className="space-y-1">
            {citations.map((citation) => (
              <li key={citation.articleId}>
                <Link
                  href={`${kbBasePath}/${citation.slug}`}
                  target="_blank"
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors',
                    citation.used
                      ? 'border-brand-500/40 bg-brand-50/60 text-ink hover:border-brand-500'
                      : 'border-line text-muted hover:text-ink',
                  )}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    {citation.used && <Check className="h-3 w-3 shrink-0 text-brand-600" aria-hidden />}
                    <span className="truncate">{citation.title}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {Math.round(citation.similarity * 100)}%
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        {isPending ? (
          editing ? (
            <>
              <Button size="sm" loading={busy} onClick={() => onReview('edit')} disabled={!editText.trim()}>
                <Check className="h-3.5 w-3.5" aria-hidden />
                Save & approve
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancelEdit} disabled={busy}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="success" loading={busy} onClick={() => onReview('approve')}>
                <Check className="h-3.5 w-3.5" aria-hidden />
                Approve & use
              </Button>
              <Button size="sm" variant="outline" onClick={onStartEdit} disabled={busy}>
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Edit
              </Button>
              <Button size="sm" variant="ghost" loading={busy} onClick={() => onReview('reject')}>
                <X className="h-3.5 w-3.5" aria-hidden />
                Reject
              </Button>
            </>
          )
        ) : suggestion.status === 'REJECTED' ? (
          <p className="text-xs text-muted">
            Rejected{suggestion.reviewedBy ? ` by ${suggestion.reviewedBy.name}` : ''}. Regenerate for a
            fresh draft.
          </p>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={onReuse}>
              Load into reply box
            </Button>
            <p className="self-center text-xs text-muted">
              {suggestion.status === 'EDITED' ? 'Edited and approved' : 'Approved'}
              {suggestion.reviewedBy ? ` by ${suggestion.reviewedBy.name}` : ''}
            </p>
          </>
        )}
      </div>
    </>
  );
}

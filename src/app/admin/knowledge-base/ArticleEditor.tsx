'use client';

import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { TICKET_CATEGORIES } from '@/lib/constants';

export type ArticleDraft = {
  id?: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  tags: string[];
  isPublished: boolean;
  chunkCount?: number;
  slug?: string;
};

/** Create/edit form. Saving re-chunks and re-embeds so RAG never goes stale. */
export function ArticleEditor({ initial }: { initial: ArticleDraft }) {
  const router = useRouter();
  const toast = useToast();

  const isEdit = Boolean(initial.id);
  const [values, setValues] = useState(initial);
  const [tagInput, setTagInput] = useState(initial.tags.join(', '));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function validate() {
    const next: Record<string, string> = {};
    if (values.title.trim().length < 4) next.title = 'Title must be at least 4 characters.';
    if (values.summary.trim().length < 10) next.summary = 'Add a one-line summary (10+ characters).';
    if (values.content.trim().length < 40) next.content = 'Article content must be at least 40 characters.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    const tags = tagInput
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 10);

    const body = {
      title: values.title.trim(),
      summary: values.summary.trim(),
      content: values.content.trim(),
      category: values.category,
      tags,
      isPublished: values.isPublished,
    };

    setSaving(true);
    try {
      const result = await apiFetch<{ message: string; article: { id: string }; indexError?: string }>(
        isEdit ? `/api/kb/${initial.id}` : '/api/kb',
        { method: isEdit ? 'PATCH' : 'POST', body },
      );

      if (result.indexError) {
        toast.error('Saved, but embedding failed', result.indexError);
      } else {
        toast.success(result.message);
      }

      router.push('/admin/knowledge-base');
      router.refresh();
    } catch (caught) {
      setFormError(errorMessage(caught, 'Could not save the article.'));
      setSaving(false);
    }
  }

  return (
    <>
      <Link
        href="/admin/knowledge-base"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to knowledge base
      </Link>

      <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-3" noValidate>
        <Card className="lg:col-span-2">
          <CardHeader
            title={isEdit ? 'Edit article' : 'New article'}
            description="Write for a staff to paste from — concrete, specific, and free of marketing language."
          />
          <CardBody className="space-y-4">
            {formError && <Alert tone="error">{formError}</Alert>}

            <Input
              label="Title"
              placeholder="Fixing duplicate charges on your card"
              required
              maxLength={160}
              value={values.title}
              onChange={(event) => {
                setValues((c) => ({ ...c, title: event.target.value }));
                setErrors((c) => ({ ...c, title: '' }));
              }}
              error={errors.title}
            />

            <Textarea
              label="Summary"
              placeholder="One sentence describing what this article answers."
              required
              rows={2}
              maxLength={400}
              value={values.summary}
              onChange={(event) => {
                setValues((c) => ({ ...c, summary: event.target.value }));
                setErrors((c) => ({ ...c, summary: '' }));
              }}
              error={errors.summary}
              hint={`${values.summary.length}/400 — this is also embedded, so make it descriptive.`}
            />

            <Textarea
              label="Content"
              placeholder={
                'Write in short paragraphs separated by a blank line.\n\nEach paragraph becomes part of a retrievable chunk, so keep one idea per paragraph.'
              }
              required
              rows={18}
              maxLength={40000}
              value={values.content}
              onChange={(event) => {
                setValues((c) => ({ ...c, content: event.target.value }));
                setErrors((c) => ({ ...c, content: '' }));
              }}
              error={errors.content}
              hint={`${values.content.length}/40000 — paragraphs are chunked with overlap and embedded on save.`}
            />
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Classification" />
            <CardBody className="space-y-4">
              <Select
                label="Category"
                value={values.category}
                onChange={(event) => setValues((c) => ({ ...c, category: event.target.value }))}
                options={TICKET_CATEGORIES.map((category) => ({
                  value: category.value,
                  label: category.label,
                }))}
                hint="Used to scope retrieval when a ticket has the same category."
              />

              <Input
                label="Tags"
                placeholder="refund, billing, policy"
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                hint="Comma-separated, up to 10. Tags are weighted in lexical search."
              />

              <Checkbox
                label="Published"
                hint="Only published articles are visible to members and retrievable by the AI."
                checked={values.isPublished}
                onChange={(event) => setValues((c) => ({ ...c, isPublished: event.target.checked }))}
              />
            </CardBody>
          </Card>

          {isEdit && (
            <Card>
              <CardHeader title="Index status" />
              <CardBody className="space-y-1.5 text-sm">
                <Row label="Slug" value={initial.slug ?? '—'} />
                <Row label="Vector chunks" value={String(initial.chunkCount ?? 0)} />
                <p className="pt-1 text-xs leading-relaxed text-muted">
                  Changing the title, summary or content re-chunks and re-embeds this article
                  automatically when you save.
                </p>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardBody className="flex flex-col gap-2">
              <Button type="submit" fullWidth loading={saving}>
                {!saving && <Save className="h-4 w-4" aria-hidden />}
                {saving ? 'Saving & embedding…' : isEdit ? 'Save changes' : 'Create article'}
              </Button>
              <Link href="/admin/knowledge-base">
                <Button type="button" variant="outline" fullWidth disabled={saving}>
                  Cancel
                </Button>
              </Link>
            </CardBody>
          </Card>
        </div>
      </form>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-xs text-muted">{label}</span>
      <span className="min-w-0 break-all text-right text-sm text-ink">{value}</span>
    </div>
  );
}

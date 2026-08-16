'use client';

import { Paperclip, Send, Sparkles, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';
import { apiFetch, apiUpload, errorMessage } from '@/lib/api-client';
import { ALLOWED_EXTENSIONS_CLIENT, TICKET_CATEGORIES, TICKET_PRIORITIES } from '@/lib/constants';
import { formatBytes } from '@/lib/utils';

type CreateResponse = {
  message: string;
  ticket: {
    id: string;
    number: number;
    category: string;
    priority: string;
    aiSummary: string | null;
    aiConfidence: number | null;
    assignee: { name: string } | null;
  };
  triageError: string | null;
};

type Suggestion = { id: string; title: string; slug: string; summary: string; similarity: number };

export function NewTicketForm() {
  const router = useRouter();
  const toast = useToast();

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live "before you submit" knowledge base suggestions, debounced.
  useEffect(() => {
    const query = `${subject} ${body}`.trim();
    if (query.length < 12) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const data = await apiFetch<{ results: Suggestion[] }>(
          `/api/kb/search?query=${encodeURIComponent(query.slice(0, 300))}&limit=3`,
          { signal: controller.signal },
        );
        setSuggestions(data.results.filter((r) => r.similarity > 0.12));
      } catch {
        /* suggestions are a nicety — silence failures */
      }
    }, 700);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [subject, body]);

  function validate() {
    const next: Record<string, string> = {};
    if (subject.trim().length < 5) next.subject = 'Give your ticket a subject of at least 5 characters.';
    if (subject.trim().length > 160) next.subject = 'Keep the subject under 160 characters.';
    if (body.trim().length < 20) next.body = 'Please describe the issue in at least 20 characters.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function addFiles(selected: FileList | null) {
    if (!selected) return;
    setFiles((current) => [...current, ...Array.from(selected)].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const result = await apiFetch<CreateResponse>('/api/tickets', {
        method: 'POST',
        body: {
          subject: subject.trim(),
          body: body.trim(),
          category: category || undefined,
          priority: priority || undefined,
        },
      });

      if (files.length > 0) {
        try {
          const form = new FormData();
          for (const file of files) form.append('files', file);
          await apiUpload(`/api/tickets/${result.ticket.id}/attachments`, form);
        } catch (uploadError) {
          // The ticket exists — report the upload problem without losing it.
          toast.error('Ticket created, but an attachment failed', errorMessage(uploadError));
        }
      }

      toast.success(
        `Ticket #${result.ticket.number} created`,
        result.triageError ??
          `Triaged as ${result.ticket.priority.toLowerCase()} priority${
            result.ticket.assignee ? ` and assigned to ${result.ticket.assignee.name}` : ''
          }.`,
      );

      router.push(`/member/tickets/${result.ticket.id}`);
      router.refresh();
    } catch (caught) {
      setFormError(errorMessage(caught, 'Could not create your ticket.'));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {formError && <Alert tone="error">{formError}</Alert>}

      <Input
        label="Subject"
        placeholder="e.g. Charged twice for the Growth plan this month"
        required
        maxLength={160}
        value={subject}
        onChange={(event) => {
          setSubject(event.target.value);
          setErrors((c) => ({ ...c, subject: '' }));
        }}
        error={errors.subject}
        hint={`${subject.length}/160`}
      />

      <Textarea
        label="Describe the issue"
        placeholder="What happened, what you expected, and anything you've already tried. Include IDs, error messages or dates where you can."
        required
        rows={8}
        maxLength={8000}
        value={body}
        onChange={(event) => {
          setBody(event.target.value);
          setErrors((c) => ({ ...c, body: '' }));
        }}
        error={errors.body}
        hint={`${body.length}/8000 — the more detail, the more accurate our AI triage.`}
      />

      {suggestions.length > 0 && (
        <div className="rounded-lg border border-brand-500/25 bg-brand-50/50 p-3.5">
          <p className="flex items-center gap-1.5 text-sm font-medium text-brand-700">
            <Sparkles className="h-4 w-4" aria-hidden />
            These articles might answer your question already
          </p>
          <ul className="mt-2 space-y-1.5">
            {suggestions.map((suggestion) => (
              <li key={suggestion.id}>
                <a
                  href={`/member/knowledge-base/${suggestion.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-md bg-surface px-2.5 py-2 text-sm text-ink transition-colors hover:text-brand-600"
                >
                  <span className="font-medium">{suggestion.title}</span>
                  <span className="ml-1.5 text-xs text-muted">
                    {Math.round(suggestion.similarity * 100)}% match
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">{suggestion.summary}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Category"
          placeholder="Let AI decide"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          options={TICKET_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
          hint="Optional — AI triage will refine this."
        />
        <Select
          label="Priority"
          placeholder="Let AI decide"
          value={priority}
          onChange={(event) => setPriority(event.target.value)}
          options={TICKET_PRIORITIES.map((p) => ({ value: p.value, label: p.label }))}
          hint="Optional — final priority is set by triage."
        />
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-medium text-ink">Attachments</span>
        <input
          ref={fileInputRef}
          id="new-ticket-files"
          type="file"
          multiple
          accept={ALLOWED_EXTENSIONS_CLIENT.join(',')}
          onChange={(event) => addFiles(event.target.files)}
          className="hidden"
        />
        <label
          htmlFor="new-ticket-files"
          className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-line bg-surface px-4 text-sm font-medium text-muted transition-colors hover:border-brand-500 hover:text-brand-600"
        >
          <Paperclip className="h-4 w-4" aria-hidden />
          Choose files
        </label>
        <p className="mt-1 text-xs text-muted">
          Up to 5 files, 10 MB each. Screenshots and logs help a lot.
        </p>

        {files.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink"
              >
                <Paperclip className="h-3 w-3 text-muted" aria-hidden />
                <span className="max-w-[180px] truncate">{file.name}</span>
                <span className="text-muted">{formatBytes(file.size)}</span>
                <button
                  type="button"
                  onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                  className="text-muted transition-colors hover:text-red-600"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {!submitting && <Send className="h-4 w-4" aria-hidden />}
          {submitting ? 'Creating & triaging…' : 'Submit ticket'}
        </Button>
      </div>
    </form>
  );
}

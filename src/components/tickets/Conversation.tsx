'use client';

import { Bot, Dumbbell, Lock, Paperclip, Send, Sparkles, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Alert, Spinner } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';
import { apiFetch, apiUpload, errorMessage } from '@/lib/api-client';
import { ALLOWED_EXTENSIONS_CLIENT } from '@/lib/constants';
import { cn, formatBytes, formatDateTime, initials, relativeTime } from '@/lib/utils';

export type ConversationMessage = {
  id: string;
  body: string;
  authorType: 'MEMBER' | 'STAFF' | 'SYSTEM' | 'AI';
  isInternal: boolean;
  fromAiDraftId: string | null;
  createdAt: string;
  author: { id: string; name: string; role: string; avatarColor: string } | null;
  attachments: Array<{ id: string; filename: string; mimeType: string; sizeBytes: number }>;
};

const POLL_INTERVAL_MS = 6000;

/**
 * Threaded ticket conversation with attachment upload.
 * New messages are picked up by polling `?since=` — deliberately simple and
 * reliable, with no websocket infrastructure to run.
 */
export function Conversation({
  ticketId,
  initialMessages,
  currentUserId,
  canPostInternalNote,
  disabled,
  disabledReason,
  draftText,
  onDraftConsumed,
  onMessageSent,
}: {
  ticketId: string;
  initialMessages: ConversationMessage[];
  currentUserId: string;
  canPostInternalNote: boolean;
  disabled?: boolean;
  disabledReason?: string;
  draftText?: string | null;
  onDraftConsumed?: () => void;
  onMessageSent?: () => void;
}) {
  const toast = useToast();
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const usedDraftId = useRef<string | null>(null);

  // Load an approved AI draft into the composer.
  useEffect(() => {
    if (draftText) {
      setBody(draftText);
      setInternal(false);
      onDraftConsumed?.();
      document.getElementById('reply-composer')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftText]);

  const latestTimestamp = messages.at(-1)?.createdAt;

  const poll = useCallback(async () => {
    if (!latestTimestamp) return;
    try {
      const data = await apiFetch<{ messages: ConversationMessage[] }>(
        `/api/tickets/${ticketId}/messages?since=${encodeURIComponent(latestTimestamp)}`,
      );
      if (data.messages.length > 0) {
        setMessages((current) => {
          const seen = new Set(current.map((m) => m.id));
          return [...current, ...data.messages.filter((m) => !seen.has(m.id))];
        });
      }
    } catch {
      /* Polling errors are transient; the next tick retries. */
    }
  }, [ticketId, latestTimestamp]);

  useEffect(() => {
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [poll]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length]);

  function addFiles(selected: FileList | null) {
    if (!selected) return;
    const incoming = Array.from(selected);
    setFiles((current) => [...current, ...incoming].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function send() {
    const trimmed = body.trim();
    if (!trimmed) {
      setError('Write a message before sending.');
      return;
    }

    setError(null);
    setSending(true);
    try {
      const result = await apiFetch<{ data: ConversationMessage }>(`/api/tickets/${ticketId}/messages`, {
        method: 'POST',
        body: {
          body: trimmed,
          isInternal: internal,
          fromAiDraftId: usedDraftId.current ?? undefined,
        },
      });

      let created = result.data;

      if (files.length > 0) {
        const form = new FormData();
        form.append('messageId', created.id);
        for (const file of files) form.append('files', file);

        const uploaded = await apiUpload<{
          attachments: Array<{ id: string; filename: string; mimeType: string; sizeBytes: number }>;
        }>(`/api/tickets/${ticketId}/attachments`, form);

        created = { ...created, attachments: uploaded.attachments };
      }

      setMessages((current) => [...current, created]);
      setBody('');
      setFiles([]);
      setInternal(false);
      usedDraftId.current = null;
      onMessageSent?.();
      toast.success(internal ? 'Internal note added.' : 'Message sent.');
    } catch (caught) {
      const message = errorMessage(caught, 'Could not send your message.');
      setError(message);
      toast.error('Message not sent', message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col">
      <div className="scrollbar-thin max-h-[560px] space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No messages yet.</p>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} isOwn={message.author?.id === currentUserId} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div id="reply-composer" className="border-t border-line bg-surface-2/40 px-4 py-3.5 sm:px-5">
        {disabled ? (
          <Alert tone="info">{disabledReason ?? 'Replies are disabled on this ticket.'}</Alert>
        ) : (
          <>
            {error && (
              <Alert tone="error" className="mb-3">
                {error}
              </Alert>
            )}

            <textarea
              value={body}
              onChange={(event) => {
                setBody(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') send();
              }}
              rows={4}
              disabled={sending}
              placeholder={
                internal
                  ? 'Internal note — only visible to staff and admins…'
                  : 'Write your reply…  (⌘/Ctrl + Enter to send)'
              }
              aria-label={internal ? 'Internal note' : 'Reply message'}
              className={cn(
                'w-full resize-y rounded-lg border bg-surface px-3 py-2.5 text-sm leading-relaxed text-ink placeholder:text-muted/70 disabled:opacity-60',
                internal ? 'border-amber-300 bg-amber-50/40 dark:bg-amber-500/5' : 'border-line',
              )}
            />

            {files.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {files.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink"
                  >
                    <Paperclip className="h-3 w-3 text-muted" aria-hidden />
                    <span className="max-w-[160px] truncate">{file.name}</span>
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

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ALLOWED_EXTENSIONS_CLIENT.join(',')}
                  onChange={(event) => addFiles(event.target.files)}
                  className="hidden"
                  id="attachment-input"
                />
                <label
                  htmlFor="attachment-input"
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-muted transition-colors hover:text-ink"
                >
                  <Paperclip className="h-4 w-4" aria-hidden />
                  Attach
                </label>

                {canPostInternalNote && (
                  <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-muted">
                    <input
                      type="checkbox"
                      checked={internal}
                      onChange={(event) => setInternal(event.target.checked)}
                      className="h-4 w-4 rounded border-line accent-amber-500"
                    />
                    <Lock className="h-3.5 w-3.5" aria-hidden />
                    Internal note
                  </label>
                )}
              </div>

              <Button onClick={send} loading={sending} disabled={!body.trim()}>
                {!sending && <Send className="h-4 w-4" aria-hidden />}
                {sending ? 'Sending…' : internal ? 'Add note' : 'Send reply'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message, isOwn }: { message: ConversationMessage; isOwn: boolean }) {
  const isSystem = message.authorType === 'SYSTEM';
  const isAi = message.authorType === 'AI';

  // System messages are the automatic acknowledgement. They render as a real
  // message (the member is meant to read them) but are visibly labelled
  // automatic, so nobody mistakes one for a staff member having replied.
  if (isSystem) {
    return (
      <div className="flex gap-3">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted"
          aria-hidden
        >
          <Dumbbell className="h-4 w-4" />
        </span>
        <div className="min-w-0 max-w-[85%] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-ink">IronCore Fitness</span>
            <span className="rounded bg-surface-2 px-1.5 py-px text-[10px] font-medium text-muted">
              Automatic
            </span>
            <time
              className="text-[11px] text-muted"
              dateTime={message.createdAt}
              title={formatDateTime(message.createdAt)}
            >
              {relativeTime(message.createdAt)}
            </time>
          </div>
          <div className="mt-1.5 whitespace-pre-wrap rounded-xl border border-dashed border-line bg-surface-2/40 px-3.5 py-2.5 text-sm leading-relaxed text-ink">
            {message.body}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex gap-3', isOwn && 'flex-row-reverse')}>
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
        style={{ backgroundColor: isAi ? '#7c3aed' : (message.author?.avatarColor ?? '#64748b') }}
        aria-hidden
      >
        {isAi ? <Bot className="h-4 w-4" /> : initials(message.author?.name ?? '?')}
      </span>

      <div className={cn('min-w-0 max-w-[85%] flex-1', isOwn && 'flex flex-col items-end')}>
        <div className={cn('flex flex-wrap items-center gap-2', isOwn && 'flex-row-reverse')}>
          <span className="text-xs font-medium text-ink">
            {isAi ? 'AI assistant' : (message.author?.name ?? 'Unknown')}
          </span>
          {message.author?.role && message.author.role !== 'MEMBER' && (
            <span className="rounded bg-brand-50 px-1.5 py-px text-[10px] font-medium text-brand-700">
              {message.author.role === 'ADMIN' ? 'Admin' : 'Staff'}
            </span>
          )}
          {message.isInternal && (
            <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-px text-[10px] font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
              <Lock className="h-2.5 w-2.5" aria-hidden />
              Internal
            </span>
          )}
          {message.fromAiDraftId && (
            <span
              className="inline-flex items-center gap-1 rounded bg-violet-100 px-1.5 py-px text-[10px] font-medium text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
              title="This reply started from an AI draft that a staff reviewed"
            >
              <Sparkles className="h-2.5 w-2.5" aria-hidden />
              AI-assisted
            </span>
          )}
          <time className="text-[11px] text-muted" dateTime={message.createdAt} title={formatDateTime(message.createdAt)}>
            {relativeTime(message.createdAt)}
          </time>
        </div>

        <div
          className={cn(
            'mt-1.5 whitespace-pre-wrap rounded-xl border px-3.5 py-2.5 text-sm leading-relaxed',
            message.isInternal
              ? 'border-amber-300/60 bg-amber-50 text-amber-950 dark:bg-amber-500/10 dark:text-amber-100'
              : isOwn
                ? 'border-brand-500/30 bg-brand-50 text-ink'
                : 'border-line bg-surface text-ink',
          )}
        >
          {message.body}
        </div>

        {message.attachments.length > 0 && (
          <ul className={cn('mt-1.5 flex flex-wrap gap-1.5', isOwn && 'justify-end')}>
            {message.attachments.map((attachment) => (
              <li key={attachment.id}>
                <a
                  href={`/api/attachments/${attachment.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink transition-colors hover:border-brand-500 hover:text-brand-600"
                >
                  <Paperclip className="h-3 w-3 text-muted" aria-hidden />
                  <span className="max-w-[180px] truncate">{attachment.filename}</span>
                  <span className="text-muted">{formatBytes(attachment.sizeBytes)}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function ConversationSkeleton() {
  return (
    <div className="flex justify-center py-10">
      <Spinner label="Loading conversation…" />
    </div>
  );
}

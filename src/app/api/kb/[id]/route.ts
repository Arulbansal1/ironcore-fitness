import { recordAudit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { ApiError, clientIp, ok, readJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { deindexArticle, indexArticle } from '@/lib/rag';
import { kbArticleSchema } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

export const GET = route(async (request: Request, context: Params) => {
  const { id } = await context.params;
  const user = await requireUser();

  const article = await prisma.kbArticle.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true } },
      _count: { select: { chunks: true } },
    },
  });

  if (!article) throw ApiError.notFound('That article does not exist.');
  if (!article.isPublished && user.role !== 'ADMIN') {
    throw ApiError.notFound('That article does not exist.');
  }

  return ok({ article });
});

/**
 * Updates an article. Content changes trigger a re-embed so the vector index
 * can never drift out of sync with what the article actually says.
 */
export const PATCH = route(async (request: Request, context: Params) => {
  const { id } = await context.params;
  const user = await requireUser(['ADMIN']);
  const input = kbArticleSchema.partial().parse(await readJson(request));

  const existing = await prisma.kbArticle.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('That article does not exist.');

  const article = await prisma.kbArticle.update({
    where: { id },
    data: {
      title: input.title ?? undefined,
      summary: input.summary ?? undefined,
      content: input.content ?? undefined,
      category: input.category ?? undefined,
      tags: input.tags ?? undefined,
      isPublished: input.isPublished ?? undefined,
    },
  });

  const contentChanged =
    (input.title !== undefined && input.title !== existing.title) ||
    (input.summary !== undefined && input.summary !== existing.summary) ||
    (input.content !== undefined && input.content !== existing.content);

  let chunkCount: number | null = null;
  let indexError: string | null = null;

  if (contentChanged) {
    try {
      chunkCount = await indexArticle(id);
    } catch (error) {
      console.error('[kb] reindex failed', error);
      indexError = 'The article was saved but could not be re-embedded. Use "Reindex" to retry.';
    }
  }

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'kb.article_updated',
    entityType: 'KbArticle',
    entityId: id,
    detail: `${article.title}${contentChanged ? ` (re-embedded into ${chunkCount ?? 0} chunks)` : ''}`,
    metadata: { contentChanged, published: article.isPublished },
    ip: clientIp(request),
  });

  return ok({
    message: contentChanged
      ? `Article updated and re-embedded into ${chunkCount ?? 0} chunk(s).`
      : 'Article updated.',
    article,
    chunkCount,
    indexError,
  });
});

export const DELETE = route(async (request: Request, context: Params) => {
  const { id } = await context.params;
  const user = await requireUser(['ADMIN']);

  const article = await prisma.kbArticle.findUnique({ where: { id } });
  if (!article) throw ApiError.notFound('That article does not exist.');

  // Chunks cascade with the article, but drop the vectors explicitly so a
  // failure here surfaces rather than silently orphaning embeddings.
  await deindexArticle(id);
  await prisma.kbArticle.delete({ where: { id } });

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'kb.article_deleted',
    entityType: 'KbArticle',
    entityId: id,
    detail: article.title,
    metadata: { slug: article.slug },
    ip: clientIp(request),
  });

  return ok({ message: `"${article.title}" deleted.` });
});

/** Force a re-embed without changing the text (used after switching AI engines). */
export const POST = route(async (request: Request, context: Params) => {
  const { id } = await context.params;
  const user = await requireUser(['ADMIN']);

  const article = await prisma.kbArticle.findUnique({ where: { id }, select: { id: true, title: true } });
  if (!article) throw ApiError.notFound('That article does not exist.');

  const chunkCount = await indexArticle(id);

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'kb.article_reindexed',
    entityType: 'KbArticle',
    entityId: id,
    detail: `${article.title} re-embedded into ${chunkCount} chunk(s)`,
  });

  return ok({ message: `Re-embedded into ${chunkCount} chunk(s).`, chunkCount });
});

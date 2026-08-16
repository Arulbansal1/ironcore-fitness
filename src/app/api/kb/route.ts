import { recordAudit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { ApiError, clientIp, ok, readJson, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { indexArticle, vectorIndexStats } from '@/lib/rag';
import { slugify } from '@/lib/utils';
import { kbArticleSchema } from '@/lib/validation';

export const GET = route(async (request: Request) => {
  const user = await requireUser();
  const url = new URL(request.url);
  const includeDrafts = url.searchParams.get('includeDrafts') === 'true' && user.role === 'ADMIN';

  const [articles, stats] = await Promise.all([
    prisma.kbArticle.findMany({
      where: includeDrafts ? {} : { isPublished: true },
      orderBy: { updatedAt: 'desc' },
      include: {
        author: { select: { id: true, name: true } },
        _count: { select: { chunks: true } },
      },
    }),
    vectorIndexStats(),
  ]);

  return ok({ articles, stats });
});

/** Creates an article and immediately embeds it so RAG can retrieve it. */
export const POST = route(async (request: Request) => {
  const user = await requireUser(['ADMIN']);
  const input = kbArticleSchema.parse(await readJson(request));

  const baseSlug = slugify(input.title);
  if (!baseSlug) throw ApiError.badRequest('The title must contain some letters or numbers.');

  // Slugs are unique — append a counter rather than failing on a duplicate title.
  let slug = baseSlug;
  let attempt = 1;
  while (await prisma.kbArticle.findUnique({ where: { slug }, select: { id: true } })) {
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
    if (attempt > 50) throw ApiError.conflict('Could not generate a unique slug for that title.');
  }

  const article = await prisma.kbArticle.create({
    data: {
      title: input.title,
      slug,
      summary: input.summary,
      content: input.content,
      category: input.category,
      tags: input.tags,
      isPublished: input.isPublished,
      authorId: user.id,
    },
  });

  let chunkCount = 0;
  let indexError: string | null = null;
  try {
    chunkCount = await indexArticle(article.id);
  } catch (error) {
    console.error('[kb] indexing failed', error);
    indexError = 'The article was saved but could not be embedded. Use "Reindex" to retry.';
  }

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'kb.article_created',
    entityType: 'KbArticle',
    entityId: article.id,
    detail: `${article.title} (${chunkCount} chunks embedded)`,
    metadata: { slug, category: article.category, published: article.isPublished },
    ip: clientIp(request),
  });

  return ok(
    {
      message: `Article created and embedded into ${chunkCount} chunk(s).`,
      article,
      chunkCount,
      indexError,
    },
    201,
  );
});

import { requireUser } from '@/lib/auth';
import { activeEmbeddingModel } from '@/lib/ai';
import { ok, route } from '@/lib/http';
import { searchKnowledgeBase } from '@/lib/rag';
import { kbSearchSchema } from '@/lib/validation';

/**
 * Vector similarity search over the published knowledge base.
 * Backs the "before you submit" suggestions and the staff's inline lookup.
 */
export const GET = route(async (request: Request) => {
  await requireUser();

  const url = new URL(request.url);
  const input = kbSearchSchema.parse({
    query: url.searchParams.get('query') ?? '',
    limit: url.searchParams.get('limit') ?? 5,
  });

  const chunks = await searchKnowledgeBase(input.query, { limit: input.limit });

  return ok({
    query: input.query,
    engine: activeEmbeddingModel(),
    results: chunks.map((chunk) => ({
      id: chunk.articleId,
      articleId: chunk.articleId,
      title: chunk.title,
      slug: chunk.slug,
      summary: chunk.content.slice(0, 220).replace(/\s+/g, ' ').trim(),
      excerpt: chunk.content,
      similarity: chunk.similarity,
    })),
  });
});

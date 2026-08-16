import 'server-only';

import { Prisma, type TicketCategory } from '@prisma/client';

import { embed, embedMany, type RetrievedChunk } from './ai';
import { prisma } from './prisma';

/**
 * Knowledge Base retrieval layer.
 *
 * pgvector columns are not representable in Prisma Client, so chunk embeddings
 * are written and searched with parameterised raw SQL. Similarity uses the
 * cosine distance operator `<=>`; similarity = 1 - distance.
 */

const CHUNK_TARGET_CHARS = 900;
const CHUNK_OVERLAP_CHARS = 150;

/** Splits an article into overlapping, paragraph-aligned chunks. */
export function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  if (normalized.length <= CHUNK_TARGET_CHARS) return [normalized];

  const paragraphs = normalized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    if (paragraph.length > CHUNK_TARGET_CHARS) {
      if (current) {
        chunks.push(current.trim());
        current = '';
      }
      for (let i = 0; i < paragraph.length; i += CHUNK_TARGET_CHARS - CHUNK_OVERLAP_CHARS) {
        chunks.push(paragraph.slice(i, i + CHUNK_TARGET_CHARS).trim());
      }
      continue;
    }

    if ((current + '\n\n' + paragraph).length > CHUNK_TARGET_CHARS && current) {
      chunks.push(current.trim());
      const tail = current.slice(-CHUNK_OVERLAP_CHARS);
      current = `${tail}\n\n${paragraph}`;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks.filter((c) => c.length > 20);
}

function toVectorLiteral(vector: number[]): string {
  return `[${vector.map((v) => (Number.isFinite(v) ? v.toFixed(6) : '0')).join(',')}]`;
}

/**
 * Re-chunks and re-embeds an article. Called on create and on every content
 * update so the vector index never drifts from the article text.
 */
export async function indexArticle(articleId: string): Promise<number> {
  const article = await prisma.kbArticle.findUnique({ where: { id: articleId } });
  if (!article) throw new Error(`Knowledge base article ${articleId} not found`);

  const chunks = chunkText(`${article.title}\n\n${article.summary}\n\n${article.content}`);
  await prisma.kbChunk.deleteMany({ where: { articleId } });
  if (chunks.length === 0) return 0;

  const vectors = await embedMany(chunks);

  for (let i = 0; i < chunks.length; i += 1) {
    await prisma.$executeRaw`
      INSERT INTO "KbChunk" ("id", "articleId", "chunkIndex", "content", "embedding", "createdAt")
      VALUES (
        ${cuidLike()},
        ${articleId},
        ${i},
        ${chunks[i]},
        ${toVectorLiteral(vectors[i])}::vector,
        NOW()
      )
    `;
  }

  return chunks.length;
}

/** Removes an article's vectors (used when an article is unpublished/deleted). */
export async function deindexArticle(articleId: string): Promise<void> {
  await prisma.kbChunk.deleteMany({ where: { articleId } });
}

type SearchOptions = {
  limit?: number;
  category?: TicketCategory | null;
  minSimilarity?: number;
};

type VectorRow = {
  chunkId: string;
  articleId: string;
  title: string;
  slug: string;
  content: string;
  distance: number;
};

type LexicalRow = {
  chunkId: string;
  articleId: string;
  title: string;
  slug: string;
  content: string;
  rank: number;
};

/** Reciprocal Rank Fusion constant — the standard damping value from the literature. */
const RRF_K = 60;

const FTS_STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'to', 'of',
  'in', 'on', 'at', 'for', 'with', 'my', 'i', 'it', 'this', 'that', 'you', 'we', 'they', 'me',
  'am', 'do', 'does', 'did', 'have', 'has', 'had', 'from', 'as', 'so', 'if', 'not', 'no',
  'can', 'cannot', 'will', 'would', 'should', 'there', 'what', 'when', 'why', 'how',
]);

/**
 * Builds an OR-joined tsquery from free text.
 *
 * `websearch_to_tsquery` / `plainto_tsquery` join every term with AND, so a
 * natural-language question like "money taken from my account twice" matches
 * nothing. Support queries need OR semantics with ranking doing the work.
 * Input is reduced to `[a-z0-9]+` lexemes before interpolation, so no user text
 * can reach the tsquery parser.
 */
function queryTerms(query: string): string[] {
  const terms = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((term) => term.length > 2 && !FTS_STOP_WORDS.has(term))
    .slice(0, 25);

  return [...new Set(terms)];
}

/**
 * Builds the OR-joined tsquery, dropping terms that are too common to carry
 * signal.
 *
 * `ts_rank` weights by term frequency but treats every query term as equally
 * informative, so a word appearing in most articles ("account", "arriving")
 * drowns out the one rare word that actually identifies the right document.
 * Measuring document frequency and discarding terms above a threshold is
 * classic IDF pruning, and it is what makes lexical retrieval usable here.
 */
async function buildTsQuery(query: string, totalChunks: number): Promise<string | null> {
  const terms = queryTerms(query);
  if (terms.length === 0) return null;
  if (totalChunks === 0) return terms.map((term) => `${term}:*`).join(' | ');

  const frequencies = await prisma.$queryRaw<Array<{ term: string; df: number }>>(Prisma.sql`
    SELECT t.term AS "term",
           COUNT(c."id")::int AS "df"
    FROM unnest(${terms}::text[]) AS t(term)
    LEFT JOIN "KbChunk" c
      ON to_tsvector('english', c."content") @@ to_tsquery('english', t.term || ':*')
    GROUP BY t.term
  `);

  const dfByTerm = new Map(frequencies.map((row) => [row.term, row.df]));
  const maxDocumentFraction = 0.4;

  let kept = terms.filter((term) => {
    const df = dfByTerm.get(term) ?? 0;
    return df === 0 || df / totalChunks <= maxDocumentFraction;
  });

  // If pruning removed everything the query was all common words — fall back to
  // the rarest terms rather than returning no lexical results at all.
  if (kept.length === 0) {
    kept = [...terms]
      .sort((a, b) => (dfByTerm.get(a) ?? 0) - (dfByTerm.get(b) ?? 0))
      .slice(0, 3);
  }

  // `:*` enables prefix matching so "charg" hits "charge"/"charged"/"charges".
  return kept.map((term) => `${term}:*`).join(' | ');
}

/**
 * Hybrid Knowledge Base retrieval.
 *
 * Two independent retrievers run over the same chunks:
 *   1. dense  — pgvector cosine similarity over embeddings (semantic)
 *   2. sparse — Postgres full-text search with ts_rank (lexical)
 *
 * Their rankings are combined with Reciprocal Rank Fusion. This matters because
 * dense retrieval alone misses exact identifiers ("INV-8846", "401") while
 * lexical alone misses paraphrases ("money taken twice" → "duplicate charge").
 * Fusing them is materially more accurate than either, and it keeps retrieval
 * useful when running on the local embedding fallback.
 */
export async function searchKnowledgeBase(
  query: string,
  options: SearchOptions = {},
): Promise<RetrievedChunk[]> {
  const limit = Math.min(Math.max(options.limit ?? 4, 1), 20);
  const minSimilarity = options.minSimilarity ?? 0;
  const candidateDepth = limit * 4;

  const categoryFilter = options.category
    ? Prisma.sql`AND a."category" = ${options.category}::"TicketCategory"`
    : Prisma.empty;

  const [vector, totalChunks] = await Promise.all([embed(query), prisma.kbChunk.count()]);
  const literal = toVectorLiteral(vector);
  const tsQuery = await buildTsQuery(query, totalChunks);

  const [dense, sparse] = await Promise.all([
    prisma.$queryRaw<VectorRow[]>(Prisma.sql`
      SELECT
        c."id"        AS "chunkId",
        c."articleId" AS "articleId",
        a."title"     AS "title",
        a."slug"      AS "slug",
        c."content"   AS "content",
        (c."embedding" <=> ${literal}::vector) AS "distance"
      FROM "KbChunk" c
      JOIN "KbArticle" a ON a."id" = c."articleId"
      WHERE a."isPublished" = true
        AND c."embedding" IS NOT NULL
        ${categoryFilter}
      ORDER BY c."embedding" <=> ${literal}::vector
      LIMIT ${candidateDepth}
    `),
    tsQuery
      ? prisma.$queryRaw<LexicalRow[]>(Prisma.sql`
          SELECT
            c."id"        AS "chunkId",
            c."articleId" AS "articleId",
            a."title"     AS "title",
            a."slug"      AS "slug",
            c."content"   AS "content",
            ts_rank(
              -- Custom {D,C,B,A} weights. Postgres defaults to A=1.0, which lets a
              -- single common word in a title outrank several rare words in the
              -- body. Flattening the curve keeps titles useful without letting
              -- them dominate.
              '{0.2, 0.5, 0.7, 0.85}',
              setweight(to_tsvector('english', a."title"), 'A') ||
              setweight(to_tsvector('english', array_to_string(a."tags", ' ')), 'B') ||
              setweight(to_tsvector('english', c."content"), 'C'),
              to_tsquery('english', ${tsQuery}),
              -- 32 = rank/(rank+1), normalising the score into [0,1)
              32
            ) AS "rank"
          FROM "KbChunk" c
          JOIN "KbArticle" a ON a."id" = c."articleId"
          WHERE a."isPublished" = true
            ${categoryFilter}
            AND (
              setweight(to_tsvector('english', a."title"), 'A') ||
              setweight(to_tsvector('english', array_to_string(a."tags", ' ')), 'B') ||
              setweight(to_tsvector('english', c."content"), 'C')
            ) @@ to_tsquery('english', ${tsQuery})
          ORDER BY "rank" DESC
          LIMIT ${candidateDepth}
        `)
      : Promise.resolve([] as LexicalRow[]),
  ]);

  // --- score fusion --------------------------------------------------------
  // Reciprocal Rank Fusion is excellent for *ordering* but its scores decay so
  // slowly (1/61 vs 1/62) that everything compresses near the top — useless as a
  // relevance number, and actively harmful when it feeds the AI confidence
  // score. So the two retrievers' own signals are fused probabilistically
  // instead: a chunk is relevant if EITHER retriever is confident about it.
  //
  //   relevance = 1 - (1 - dense) * (1 - sparse)
  //
  // Ordering and the reported score therefore come from the same number and can
  // never disagree. RRF rank is kept only as a deterministic tie-breaker.
  type Fused = {
    row: VectorRow | LexicalRow;
    dense: number;
    sparse: number;
    rrf: number;
  };
  const fused = new Map<string, Fused>();

  dense.forEach((row, index) => {
    // Cosine similarity is in [-1, 1]; only positive agreement counts.
    const cosine = Math.max(0, 1 - Number(row.distance));
    fused.set(row.chunkId, {
      row,
      dense: cosine,
      sparse: 0,
      rrf: 1 / (RRF_K + index + 1),
    });
  });

  sparse.forEach((row, index) => {
    const lexical = Math.max(0, Math.min(1, Number(row.rank)));
    const contribution = 1 / (RRF_K + index + 1);
    const existing = fused.get(row.chunkId);
    if (existing) {
      existing.sparse = lexical;
      existing.rrf += contribution;
    } else {
      fused.set(row.chunkId, { row, dense: 0, sparse: lexical, rrf: contribution });
    }
  });

  const scored = [...fused.values()].map((entry) => ({
    ...entry,
    relevance: 1 - (1 - entry.dense) * (1 - entry.sparse),
  }));

  scored.sort((a, b) => b.relevance - a.relevance || b.rrf - a.rrf);

  // Keep only the best chunk per article so one long article cannot fill the
  // whole context window.
  const seen = new Set<string>();
  const results: RetrievedChunk[] = [];

  for (const entry of scored) {
    if (seen.has(entry.row.articleId)) continue;
    if (entry.relevance < minSimilarity) continue;

    seen.add(entry.row.articleId);
    results.push({
      chunkId: entry.row.chunkId,
      articleId: entry.row.articleId,
      title: entry.row.title,
      slug: entry.row.slug,
      content: entry.row.content,
      similarity: Number(Math.max(0, Math.min(1, entry.relevance)).toFixed(4)),
    });

    if (results.length >= limit) break;
  }

  return results;
}

/** Count of embedded chunks, shown on the admin Knowledge Base screen. */
export async function vectorIndexStats() {
  const [articles, published, chunks] = await Promise.all([
    prisma.kbArticle.count(),
    prisma.kbArticle.count({ where: { isPublished: true } }),
    prisma.kbChunk.count(),
  ]);
  return { articles, published, chunks };
}

/** Small local id generator so raw inserts match Prisma's cuid-shaped ids. */
function cuidLike(): string {
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  return `c${Date.now().toString(36)}${random}`;
}

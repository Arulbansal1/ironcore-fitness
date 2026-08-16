/**
 * Rebuilds every Knowledge Base embedding from scratch.
 *
 *   npm run kb:reindex
 *
 * Run this after switching between the OpenAI and local embedding engines —
 * vectors from different models are not comparable, so mixing them silently
 * degrades retrieval quality.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EMBEDDING_DIMENSIONS = 1536;
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'to', 'of',
  'in', 'on', 'at', 'for', 'with', 'my', 'i', 'it', 'this', 'that', 'you', 'we', 'they', 'me',
]);

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function localEmbedding(text: string): number[] {
  const vector = new Float64Array(EMBEDDING_DIMENSIONS);
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
    .slice(0, 800);

  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const bigram = `${tokens[i]}_${tokens[i + 1]}`;
    counts.set(bigram, (counts.get(bigram) ?? 0) + 1);
  }
  for (const [term, count] of counts) {
    const h = fnv1a(term);
    vector[h % EMBEDDING_DIMENSIONS] += ((h >>> 31) & 1 ? -1 : 1) * (1 + Math.log(count));
  }
  let norm = 0;
  for (const v of vector) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return Array.from(vector, (v) => v / norm);
}

async function embedTexts(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return texts.map(localEmbedding);

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });
  if (!response.ok) throw new Error(`OpenAI responded ${response.status}: ${await response.text()}`);
  const json = (await response.json()) as { data: Array<{ index: number; embedding: number[] }> };
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

function chunkText(text: string): string[] {
  const target = 900;
  const overlap = 150;
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (normalized.length <= target) return [normalized];

  const paragraphs = normalized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  for (const paragraph of paragraphs) {
    if ((current + '\n\n' + paragraph).length > target && current) {
      chunks.push(current.trim());
      current = `${current.slice(-overlap)}\n\n${paragraph}`;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter((c) => c.length > 20);
}

function vectorLiteral(vector: number[]): string {
  return `[${vector.map((v) => (Number.isFinite(v) ? v.toFixed(6) : '0')).join(',')}]`;
}

function cuidLike(): string {
  return `c${Date.now().toString(36)}${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

async function main() {
  const engine = process.env.OPENAI_API_KEY ? 'OpenAI' : 'local vectoriser';
  console.log(`▸ Reindexing knowledge base with ${engine}\n`);

  const articles = await prisma.kbArticle.findMany({ orderBy: { createdAt: 'asc' } });
  if (articles.length === 0) {
    console.log('  No articles found. Run `npm run db:seed` first.');
    return;
  }

  let total = 0;
  for (const article of articles) {
    const chunks = chunkText(`${article.title}\n\n${article.summary}\n\n${article.content}`);
    await prisma.kbChunk.deleteMany({ where: { articleId: article.id } });

    if (chunks.length > 0) {
      const vectors = await embedTexts(chunks);
      for (let i = 0; i < chunks.length; i += 1) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "KbChunk" ("id","articleId","chunkIndex","content","embedding","createdAt")
           VALUES ($1,$2,$3,$4,$5::vector,NOW())`,
          cuidLike(),
          article.id,
          i,
          chunks[i],
          vectorLiteral(vectors[i]),
        );
      }
    }

    total += chunks.length;
    console.log(`  ✓ ${article.title} → ${chunks.length} chunk(s)`);
  }

  console.log(`\n▸ Done. ${articles.length} articles, ${total} vectors.\n`);
}

main()
  .catch((error) => {
    console.error('\n✖ Reindex failed:\n', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

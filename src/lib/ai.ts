import 'server-only';

import type { AiEngine, Sentiment, TicketCategory, TicketPriority } from '@prisma/client';
import OpenAI from 'openai';

import { EMBEDDING_DIMENSIONS, env } from './env';

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

let client: OpenAI | null = null;

function openai(): OpenAI | null {
  if (!env.openaiApiKey) return null;
  if (!client) client = new OpenAI({ apiKey: env.openaiApiKey, timeout: 30_000, maxRetries: 1 });
  return client;
}

export function aiEnabled() {
  return Boolean(env.openaiApiKey);
}

export function activeEngine(): AiEngine {
  return aiEnabled() ? 'OPENAI' : 'LOCAL_FALLBACK';
}

export function activeModelName(): string {
  return aiEnabled() ? env.openaiChatModel : 'local-heuristic-v1';
}

export function activeEmbeddingModel(): string {
  return aiEnabled() ? env.openaiEmbeddingModel : 'local-hashing-v1';
}

// ---------------------------------------------------------------------------
// Embeddings
// ---------------------------------------------------------------------------

/**
 * Deterministic hashing embedding used when no OpenAI key is present.
 * It is a real (if simple) bag-of-words feature-hashing vectoriser with sublinear
 * term weighting and L2 normalisation, so cosine similarity remains meaningful
 * and the Knowledge Base search works offline.
 */
function localEmbedding(text: string): number[] {
  const vector = new Float64Array(EMBEDDING_DIMENSIONS);
  const tokens = tokenize(text);
  const counts = new Map<string, number>();

  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  // Include bigrams so word order carries a little signal.
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const bigram = `${tokens[i]}_${tokens[i + 1]}`;
    counts.set(bigram, (counts.get(bigram) ?? 0) + 1);
  }

  for (const [term, count] of counts) {
    const h = fnv1a(term);
    const index = h % EMBEDDING_DIMENSIONS;
    const sign = (h >>> 31) & 1 ? -1 : 1;
    vector[index] += sign * (1 + Math.log(count));
  }

  let norm = 0;
  for (const value of vector) norm += value * value;
  norm = Math.sqrt(norm) || 1;
  return Array.from(vector, (value) => value / norm);
}

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'to', 'of',
  'in', 'on', 'at', 'for', 'with', 'my', 'i', 'it', 'this', 'that', 'you', 'we', 'they', 'me',
  'am', 'do', 'does', 'did', 'have', 'has', 'had', 'from', 'as', 'so', 'if', 'not', 'no',
]);

/**
 * Light suffix stripper. Not a full Porter stemmer — just enough to collapse the
 * inflections that matter for support text ("charges"/"charged" → "charge"), so
 * the local vectoriser matches paraphrases instead of exact wording.
 */
function stem(token: string): string {
  if (token.length <= 4) return token;
  for (const suffix of ['ingly', 'edly', 'ing', 'ied', 'ies', 'ed', 'es', 's', 'ly']) {
    if (token.endsWith(suffix) && token.length - suffix.length >= 3) {
      const root = token.slice(0, -suffix.length);
      // Undo the doubled consonant in "stopped" → "stop".
      if (/(.)\1$/.test(root) && !/(ss|ll|ee|oo)$/.test(root)) return root.slice(0, -1);
      return root;
    }
  }
  return token;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
    .map(stem)
    .slice(0, 800);
}

/** Returns a 1536-dimension embedding for the given text. */
export async function embed(text: string): Promise<number[]> {
  const trimmed = text.replace(/\s+/g, ' ').trim().slice(0, 8000);
  if (!trimmed) return new Array(EMBEDDING_DIMENSIONS).fill(0);

  const api = openai();
  if (!api) return localEmbedding(trimmed);

  try {
    const response = await api.embeddings.create({
      model: env.openaiEmbeddingModel,
      input: trimmed,
      dimensions: EMBEDDING_DIMENSIONS,
    });
    const vector = response.data[0]?.embedding;
    if (!vector || vector.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(`Unexpected embedding size: ${vector?.length}`);
    }
    return vector;
  } catch (error) {
    console.error('[ai] embedding failed, using local fallback:', error);
    return localEmbedding(trimmed);
  }
}

export async function embedMany(texts: string[]): Promise<number[][]> {
  const api = openai();
  if (!api) return texts.map((t) => localEmbedding(t));

  try {
    const response = await api.embeddings.create({
      model: env.openaiEmbeddingModel,
      input: texts.map((t) => t.replace(/\s+/g, ' ').trim().slice(0, 8000)),
      dimensions: EMBEDDING_DIMENSIONS,
    });
    return response.data
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding as number[]);
  } catch (error) {
    console.error('[ai] batch embedding failed, using local fallback:', error);
    return texts.map((t) => localEmbedding(t));
  }
}

// ---------------------------------------------------------------------------
// Triage: category, priority, sentiment, summary, confidence
// ---------------------------------------------------------------------------

export type TriageResult = {
  category: TicketCategory;
  priority: TicketPriority;
  sentiment: Sentiment;
  summary: string;
  tags: string[];
  confidence: number;
  engine: AiEngine;
  model: string;
  reasoning: string;
  /** True when the message mentions an injury, medical event or safety hazard. */
  safetyFlag: boolean;
};

const CATEGORIES: TicketCategory[] = [
  'MEMBERSHIP', 'EQUIPMENT', 'CLASSES', 'PERSONAL_TRAINING',
  'NUTRITION', 'INJURY', 'ACCOUNT', 'COMPLAINT', 'GENERAL',
];
const PRIORITIES: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const SENTIMENTS: Sentiment[] = ['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'FRUSTRATED'];

const TRIAGE_SYSTEM_PROMPT = `You are the triage engine for IronCore Fitness, a gym's member support desk.
Classify the incoming member enquiry and respond with STRICT JSON only, no prose, matching:
{
  "category": one of ${JSON.stringify(CATEGORIES)},
  "priority": one of ${JSON.stringify(PRIORITIES)},
  "sentiment": one of ${JSON.stringify(SENTIMENTS)},
  "summary": "one or two sentences, under 240 characters, written for a front-desk staff member",
  "tags": ["up to 5 short lowercase keywords"],
  "confidence": number between 0 and 1 describing how certain you are,
  "reasoning": "one short sentence explaining the priority choice"
}

Priority guidance for a gym:
- URGENT: any injury on the premises, a member describing pain or a medical event, a broken machine that
  is a safety hazard, a fire/flood/security issue, harassment or threatening behaviour, or a member
  charged repeatedly after cancelling.
- HIGH: a member locked out of the building, a billing dispute, a frozen or cancelled membership still
  being charged, a class cancelled with no notice, a broken machine central to the gym floor.
- MEDIUM: routine equipment faults, class booking problems, PT scheduling, general account changes.
- LOW: opening hours, guest passes, nutrition questions, timetable enquiries, general feedback.

Anything mentioning injury, pain, dizziness, chest pain, a fall, or a hazard must be categorised INJURY
or EQUIPMENT and set to URGENT — member safety outranks every other consideration.

Sentiment FRUSTRATED is for anger, threats to cancel the membership, repeated contact, or ALL-CAPS complaints.`;

export async function triageTicket(input: {
  subject: string;
  body: string;
}): Promise<TriageResult> {
  const api = openai();
  if (!api) return localTriage(input);

  try {
    const completion = await api.chat.completions.create({
      model: env.openaiChatModel,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: TRIAGE_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Subject: ${input.subject}\n\nBody:\n${input.body.slice(0, 6000)}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error('Empty completion');
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    const fallback = localTriage(input);
    return {
      category: fallback.safetyFlag
        ? fallback.category
        : pick(parsed.category, CATEGORIES, fallback.category),
      priority: fallback.safetyFlag ? 'URGENT' : pick(parsed.priority, PRIORITIES, fallback.priority),
      sentiment: pick(parsed.sentiment, SENTIMENTS, fallback.sentiment),
      summary: cleanString(parsed.summary, fallback.summary).slice(0, 400),
      tags: cleanTags(parsed.tags, fallback.tags),
      confidence: clamp01(Number(parsed.confidence)) ?? 0.7,
      engine: 'OPENAI',
      model: env.openaiChatModel,
      reasoning: cleanString(parsed.reasoning, 'Classified by the language model.').slice(0, 300),
      // Safety is not delegated to the model: the deterministic keyword scan runs
      // regardless, so a missed injury cannot slip through on a bad completion.
      safetyFlag: fallback.safetyFlag,
    };
  } catch (error) {
    console.error('[ai] triage failed, using local engine:', error);
    return localTriage(input);
  }
}

// --- local heuristic triage engine -----------------------------------------

type Rule = { words: string[]; weight: number };

/**
 * Category rules are tiered by how *diagnostic* a term is, not just by topic.
 *
 * A word like "delivery" or "order" reads as shipping in isolation but appears
 * constantly in technical text ("webhook delivery", "order pipeline"). Giving
 * every keyword equal weight lets those ambiguous words outvote a term such as
 * "webhook" that identifies the category on its own. Strong terms are therefore
 * weighted well above weak ones.
 */
const CATEGORY_RULES: Record<TicketCategory, Rule[]> = {
  MEMBERSHIP: [
    { words: ['membership', 'direct debit', 'freeze', 'frozen', 'cancel my membership', 'cancellation', 'joining fee', 'invoice', 'refund', 'overcharge', 'charged twice', 'contract', 'renewal', 'upgrade my plan', 'downgrade'], weight: 5 },
    { words: ['payment', 'billing', 'charge', 'charged', 'subscription', 'plan', 'price', 'fee'], weight: 2 },
  ],
  EQUIPMENT: [
    { words: ['treadmill', 'squat rack', 'bench press', 'dumbbell', 'barbell', 'cable machine', 'leg press', 'rower', 'spin bike', 'elliptical', 'locker', 'shower', 'changing room', 'sauna', 'air conditioning', 'broken', 'out of order', 'faulty', 'jammed', 'wobbly', 'frayed cable'], weight: 5 },
    { words: ['machine', 'equipment', 'weights', 'gym floor', 'dirty', 'unclean', 'smell', 'toilet'], weight: 2 },
  ],
  CLASSES: [
    { words: ['class', 'classes', 'spin', 'yoga', 'pilates', 'hiit', 'bootcamp', 'zumba', 'body pump', 'timetable', 'waitlist', 'fully booked', 'class cancelled', 'booking', 'book a class'], weight: 5 },
    { words: ['session', 'instructor', 'studio', 'schedule'], weight: 2 },
  ],
  PERSONAL_TRAINING: [
    { words: ['personal training', 'personal trainer', 'pt session', 'pt package', 'my trainer', 'coaching block', 'programme review', 'training plan', 'one to one'], weight: 6 },
    { words: ['trainer', 'coach', 'programme', 'program'], weight: 2 },
  ],
  NUTRITION: [
    { words: ['nutrition', 'diet plan', 'meal plan', 'macros', 'calorie', 'protein', 'supplement', 'body composition', 'body fat', 'inbody', 'weight loss plan', 'bulking', 'cutting'], weight: 5 },
    { words: ['weight', 'eating', 'food'], weight: 1 },
  ],
  INJURY: [
    { words: ['injury', 'injured', 'i hurt', 'hurt my', 'pain', 'sprain', 'strain', 'pulled a muscle', 'torn', 'dizzy', 'dizziness', 'fainted', 'chest pain', 'passed out', 'fell', 'slipped', 'physio', 'medical clearance', 'doctor note', 'rehab', 'surgery'], weight: 6 },
    { words: ['sore', 'ache', 'shoulder', 'knee', 'back'], weight: 1 },
  ],
  ACCOUNT: [
    { words: ['key fob', 'keyfob', 'access card', 'wristband', 'turnstile', 'password', 'log in', 'login', 'sign in', 'locked out of the app', 'app crashes', 'change my email', 'update my details', 'verification code'], weight: 5 },
    { words: ['account', 'app', 'access', 'profile', 'details'], weight: 2 },
  ],
  COMPLAINT: [
    { words: ['complaint', 'complain', 'rude', 'unprofessional', 'harassment', 'harassed', 'intimidating', 'inappropriate', 'discriminat', 'made me uncomfortable', 'formal complaint'], weight: 6 },
    { words: ['staff was', 'another member', 'behaviour', 'behavior'], weight: 2 },
  ],
  GENERAL: [
    { words: ['opening hours', 'guest pass', 'day pass', 'bring a friend', 'parking', 'referral', 'what time'], weight: 4 },
    { words: ['question', 'help', 'how do i', 'information', 'hello', 'thanks', 'feedback'], weight: 1 },
  ],
};

/**
 * Safety terms. A gym support desk has one failure mode that matters more than
 * every other: a member reporting an injury or a hazard sitting unread in a
 * queue. These are matched separately from category scoring so that a safety
 * signal forces URGENT priority no matter what else the message is about.
 */
const SAFETY_WORDS = [
  // Injury and medical events
  'injur', 'i hurt', 'hurt my', 'hurt her', 'hurt his', 'chest pain', 'dizz', 'faint',
  'passed out', 'collapse', 'blood', 'bleeding', 'ambulance', 'paramedic', 'broke my',
  'fracture', 'concussion', 'sprain', 'torn', 'pulled a muscle',
  // Falls, near-misses and entrapment. A near-miss is reported *before* someone
  // is hurt, which is precisely when it is cheapest to act on.
  'fell', 'fall off', 'came off', 'nearly came', 'almost came', 'nearly fell', 'almost fell',
  'slip', 'trip over', 'gave way', 'jolt', 'threw me', 'thrown off', 'trapped', 'stuck under',
  'crushed', 'dropped on',
  // Equipment hazards
  'frayed', 'exposed wire', 'electric shock', 'sparks', 'unsafe', 'dangerous', 'hazard',
  'wobbl', 'loose plate', 'cracked', 'snapped',
  // Premises and conduct
  'fire', 'flood', 'gas smell', 'harass', 'threaten', 'assault', 'followed me', 'stalked',
];

const URGENT_WORDS = [
  'urgent', 'asap', 'immediately', 'emergency', 'unsafe', 'dangerous', 'hazard',
  // Money taken incorrectly. Members phrase this many ways — "deducted twice",
  // "taken twice", "billed twice" — and matching only one spelling is how a real
  // duplicate charge ends up sitting in the medium queue.
  'twice', 'double charged', 'double payment', 'duplicate charge', 'duplicate payment',
  'two payments', 'still charging me', 'still being charged', 'charged after cancel',
  'locked in', 'cannot get in', "can't get in", 'security',
];
const HIGH_WORDS = ['broken', 'out of order', 'not working', 'refund', 'dispute', 'escalate', 'unacceptable', 'still waiting', 'third time', 'cancelled my membership', 'locked out', 'no notice'];
const LOW_WORDS = ['question', 'how do i', 'wondering', 'suggestion', 'guest pass', 'opening hours', 'timetable', 'curious', 'just checking'];

const NEGATIVE_WORDS = ['disappointed', 'unhappy', 'poor', 'bad', 'slow', 'issue', 'problem', 'annoying', 'confusing'];
const FRUSTRATED_WORDS = ['furious', 'angry', 'ridiculous', 'unacceptable', 'terrible', 'worst gym', 'cancel my membership', 'cancelling my membership', 'lawyer', 'refund now', 'fed up', 'no one has', 'nobody has', 'third time', 'still no response', 'joke of a'];
const POSITIVE_WORDS = ['thanks', 'thank you', 'great', 'love', 'appreciate', 'excellent', 'awesome', 'helpful'];

function countHits(haystack: string, words: string[]): number {
  return words.reduce((total, word) => (haystack.includes(word) ? total + 1 : total), 0);
}

export function localTriage(input: { subject: string; body: string }): TriageResult {
  const text = `${input.subject}\n${input.body}`.toLowerCase();

  // --- category ---
  let bestCategory: TicketCategory = 'GENERAL';
  let bestScore = 0;
  for (const category of CATEGORIES) {
    const score = CATEGORY_RULES[category].reduce(
      (total, rule) => total + countHits(text, rule.words) * rule.weight,
      0,
    );
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  // --- safety override ---
  // Checked before anything else. A member reporting an injury or a hazard is
  // never merely "medium priority", regardless of how the rest of the message
  // scores, so this short-circuits the normal priority ladder.
  const safetyHits = countHits(text, SAFETY_WORDS);
  const safetyFlag = safetyHits > 0;

  // --- priority ---
  const urgentHits = countHits(text, URGENT_WORDS);
  const highHits = countHits(text, HIGH_WORDS);
  const lowHits = countHits(text, LOW_WORDS);
  const shouty = /[A-Z]{6,}/.test(input.subject) || (input.body.match(/!/g)?.length ?? 0) >= 3;

  let priority: TicketPriority;
  if (safetyFlag) priority = 'URGENT';
  else if (urgentHits >= 2 || (urgentHits >= 1 && shouty)) priority = 'URGENT';
  else if (urgentHits === 1 || highHits >= 2) priority = 'HIGH';
  else if (lowHits >= 1 && highHits === 0) priority = 'LOW';
  else priority = 'MEDIUM';

  // A safety report is an injury issue unless it is clearly about the equipment
  // that caused it.
  if (safetyFlag && bestCategory !== 'EQUIPMENT' && bestCategory !== 'COMPLAINT') {
    bestCategory = 'INJURY';
  }

  // --- sentiment ---
  const frustratedHits = countHits(text, FRUSTRATED_WORDS);
  const negativeHits = countHits(text, NEGATIVE_WORDS);
  const positiveHits = countHits(text, POSITIVE_WORDS);

  let sentiment: Sentiment;
  if (frustratedHits >= 1 || (negativeHits >= 3 && shouty)) sentiment = 'FRUSTRATED';
  else if (negativeHits >= 1 && negativeHits > positiveHits) sentiment = 'NEGATIVE';
  else if (positiveHits >= 1 && negativeHits === 0) sentiment = 'POSITIVE';
  else sentiment = 'NEUTRAL';

  // --- summary (extractive) ---
  const sentences = input.body
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 12);
  const summary = (
    sentences.length > 0
      ? `${input.subject.trim()} — ${sentences.slice(0, 2).join(' ')}`
      : input.subject.trim() || 'Member enquiry.'
  ).slice(0, 240);

  // --- tags ---
  const tags = topTerms(text, 5);

  // Confidence reflects how much signal the rules actually found.
  const signal = bestScore + urgentHits + highHits + frustratedHits;
  const confidence = Math.min(0.88, 0.42 + signal * 0.06);

  return {
    category: bestCategory,
    priority,
    sentiment,
    summary,
    tags,
    confidence: Number(confidence.toFixed(2)),
    engine: 'LOCAL_FALLBACK',
    model: 'local-heuristic-v1',
    reasoning: safetyFlag
      ? `Safety keyword detected (${safetyHits} signal(s)) — forced to urgent priority for member wellbeing.`
      : `Keyword engine matched ${bestScore} category signal(s), ${urgentHits} urgency signal(s) and ${frustratedHits} frustration signal(s).`,
    safetyFlag,
  };
}

function topTerms(text: string, limit: number): string[] {
  const counts = new Map<string, number>();
  for (const token of tokenize(text)) {
    if (token.length < 4) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term]) => term);
}

// ---------------------------------------------------------------------------
// Reply drafting (RAG)
// ---------------------------------------------------------------------------

export type ReplyDraft = {
  draft: string;
  confidence: number;
  usedArticleIds: string[];
  engine: AiEngine;
  model: string;
};

export type RetrievedChunk = {
  chunkId: string;
  articleId: string;
  title: string;
  slug: string;
  content: string;
  similarity: number;
};

const REPLY_SYSTEM_PROMPT = `You are a senior member support staff drafting a reply for a huma staff to review.

Rules:
- Ground every factual claim in the provided knowledge base excerpts. Never invent policy, pricing, timelines or steps that are not in the excerpts.
- If the excerpts do not cover the question, say plainly that you need to check with the team and ask the one clarifying question that would unblock it.
- Match the member's tone: apologise once and concretely if they are frustrated, then move to the fix.
- Be concise: 3 short paragraphs at most, plain sentences, no marketing language, no markdown headings.
- Address the member by first name, sign off as "the Support team".

Respond with STRICT JSON only:
{
  "draft": "the full reply text",
  "confidence": number 0-1 for how well the knowledge base covered this question,
  "usedArticleIds": ["ids of the excerpts you actually relied on"]
}`;

export async function draftReply(input: {
  customerName: string;
  subject: string;
  body: string;
  history: Array<{ role: 'member' | 'staff'; text: string }>;
  context: RetrievedChunk[];
}): Promise<ReplyDraft> {
  const api = openai();
  if (!api) return localDraft(input);

  const contextBlock =
    input.context.length > 0
      ? input.context
          .map(
            (c, i) =>
              `[${i + 1}] id=${c.articleId} title="${c.title}" (similarity ${c.similarity.toFixed(2)})\n${c.content}`,
          )
          .join('\n\n---\n\n')
      : 'No relevant knowledge base article was found.';

  const conversation = input.history
    .slice(-8)
    .map((m) => `${m.role === 'member' ? 'Member' : 'Staff'}: ${m.text}`)
    .join('\n');

  try {
    const completion = await api.chat.completions.create({
      model: env.openaiChatModel,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: REPLY_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `KNOWLEDGE BASE EXCERPTS:\n${contextBlock}\n\n---\n\nCUSTOMER: ${input.customerName}\nSUBJECT: ${input.subject}\nORIGINAL MESSAGE:\n${input.body.slice(0, 4000)}\n\nCONVERSATION SO FAR:\n${conversation || '(no replies yet)'}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error('Empty completion');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const draft = cleanString(parsed.draft, '').trim();
    if (!draft) throw new Error('Model returned no draft');

    const validIds = new Set(input.context.map((c) => c.articleId));
    const used = Array.isArray(parsed.usedArticleIds)
      ? (parsed.usedArticleIds as unknown[]).map(String).filter((id) => validIds.has(id))
      : [];

    return {
      draft,
      confidence: clamp01(Number(parsed.confidence)) ?? retrievalConfidence(input.context),
      usedArticleIds: used,
      engine: 'OPENAI',
      model: env.openaiChatModel,
    };
  } catch (error) {
    console.error('[ai] reply drafting failed, using local engine:', error);
    return localDraft(input);
  }
}

/**
 * Template-and-retrieval draft used without an OpenAI key. It stitches the best
 * matching knowledge base passage into a professional reply skeleton so the
 * staff always gets a usable, grounded starting point.
 */
function localDraft(input: {
  customerName: string;
  subject: string;
  body: string;
  context: RetrievedChunk[];
}): ReplyDraft {
  const firstName = input.customerName.split(' ')[0] || 'there';
  const triage = localTriage({ subject: input.subject, body: input.body });
  const top = input.context[0];

  const opener =
    triage.sentiment === 'FRUSTRATED' || triage.sentiment === 'NEGATIVE'
      ? `Hi ${firstName}, I'm sorry about the trouble with "${input.subject.trim()}" — thank you for the detail, it helps.`
      : `Hi ${firstName}, thanks for reaching out about "${input.subject.trim()}".`;

  const middle = top
    ? `Here's what applies to your case, from our guide "${top.title}":\n\n${condense(top.content, 3)}`
    : `I haven't found an existing article that covers this exactly, so I'm checking with the team. To speed that up, could you confirm when the issue started and whether it happens every time?`;

  const closer =
    triage.priority === 'URGENT' || triage.priority === 'HIGH'
      ? `I've flagged this as ${triage.priority.toLowerCase()} priority and we're staying on it until it's resolved. I'll update you as soon as I have news.\n\nBest,\nthe Support team`
      : `If that doesn't sort it, reply here and I'll pick it straight back up.\n\nBest,\nthe Support team`;

  return {
    draft: `${opener}\n\n${middle}\n\n${closer}`,
    confidence: retrievalConfidence(input.context),
    usedArticleIds: top ? [top.articleId] : [],
    engine: 'LOCAL_FALLBACK',
    model: 'local-retrieval-template-v1',
  };
}

/** Confidence derived purely from retrieval quality — used as a floor/fallback. */
export function retrievalConfidence(context: RetrievedChunk[]): number {
  if (context.length === 0) return 0.2;
  const best = context[0].similarity;
  const depth = Math.min(context.length, 3) / 3;
  return Number(Math.max(0.2, Math.min(0.95, best * 0.8 + depth * 0.15)).toFixed(2));
}

function condense(text: string, maxSentences: number): string {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .slice(0, maxSentences)
    .join(' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function pick<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  const candidate = String(value ?? '').toUpperCase().replace(/[\s-]/g, '_');
  return (allowed as string[]).includes(candidate) ? (candidate as T) : fallback;
}

function cleanString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function cleanTags(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const tags = value
    .map((t) => String(t).toLowerCase().trim())
    .filter((t) => t.length > 1 && t.length < 30)
    .slice(0, 5);
  return tags.length > 0 ? tags : fallback;
}

function clamp01(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  return Number(Math.max(0, Math.min(1, value)).toFixed(2));
}

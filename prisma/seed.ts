/**
 * IronCore Fitness — demo dataset.
 *
 *   1 manager · 4 staff · 6 members with full membership records ·
 *   8 recurring classes with bookings · check-in history ·
 *   14 knowledge base articles (chunked + embedded) ·
 *   12 support tickets across every status, priority and category, with real
 *   conversations, AI triage output, SLA state, escalations and audit history.
 *
 * Idempotent: re-running upserts users/articles and skips tickets that already
 * exist, so `npm run db:seed` is safe to repeat.
 */
import { PrismaClient, type Prisma, type TicketPriority } from '@prisma/client';
import bcrypt from 'bcryptjs';

import {
  DEMO_MEMBERS,
  DEMO_STAFF,
  DEMO_TICKETS,
  GYM_CLASSES,
  KB_ARTICLES,
  SLA_POLICIES,
} from './seed-data';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Password123';

// --- local copies of small helpers so the seed has no app-code dependency ---

const EMBEDDING_DIMENSIONS = 1536;
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'to', 'of',
  'in', 'on', 'at', 'for', 'with', 'my', 'i', 'it', 'this', 'that', 'you', 'we', 'they', 'me',
  'am', 'do', 'does', 'did', 'have', 'has', 'had', 'from', 'as', 'so', 'if', 'not', 'no',
]);

function stem(token: string): string {
  if (token.length <= 4) return token;
  for (const suffix of ['ingly', 'edly', 'ing', 'ied', 'ies', 'ed', 'es', 's', 'ly']) {
    if (token.endsWith(suffix) && token.length - suffix.length >= 3) {
      const root = token.slice(0, -suffix.length);
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
  const tokens = tokenize(text);
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

/** Uses OpenAI when a key is present, otherwise the deterministic local vectoriser. */
async function embedTexts(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return texts.map(localEmbedding);

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
        input: texts,
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    });
    if (!response.ok) throw new Error(`OpenAI responded ${response.status}`);
    const json = (await response.json()) as { data: Array<{ index: number; embedding: number[] }> };
    return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  } catch (error) {
    console.warn('  ⚠ OpenAI embedding failed, falling back to local vectoriser:', error);
    return texts.map(localEmbedding);
  }
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

/** Amber-forward palette matching the IronCore brand. */
const PALETTE = ['#f59e0b', '#ea580c', '#dc2626', '#0891b2', '#059669', '#7c3aed', '#db2777', '#0284c7'];
function colorFor(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

const SLA_MINUTES: Record<TicketPriority, { first: number; resolve: number }> = {
  URGENT: { first: 15, resolve: 240 },
  HIGH: { first: 60, resolve: 480 },
  MEDIUM: { first: 240, resolve: 1440 },
  LOW: { first: 480, resolve: 4320 },
};

/** Next calendar date matching a weekday, at least `minDaysAhead` from today. */
function nextDateForWeekday(dayOfWeek: number, minDaysAhead = 0): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + minDaysAhead);
  while (date.getDay() !== dayOfWeek) date.setDate(date.getDate() + 1);
  return date;
}

// ---------------------------------------------------------------------------

async function main() {
  console.log('\n▸ Seeding IronCore Fitness demo data\n');

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 11);

  // --- 1. Managers ----------------------------------------------------------
  // Real owner accounts, created before the demo data so the gym always has a
  // usable admin login on a fresh deployment. Override with SEED_ADMIN_EMAILS
  // (comma separated) and SEED_ADMIN_PASSWORD.
  const ownerEmails = (process.env.SEED_ADMIN_EMAILS ?? 'priyanshura400na@gmail.com')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const ownerPasswordHash = process.env.SEED_ADMIN_PASSWORD
    ? await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD, 11)
    : passwordHash;

  for (const email of ownerEmails) {
    const owner = await prisma.user.upsert({
      where: { email },
      // The password is reset on every seed. These are the owner's own accounts:
      // if re-seeding left a stale hash in place, the only admin login could be
      // locked out with no way back in short of editing the database by hand.
      update: {
        role: 'ADMIN',
        emailVerified: true,
        isActive: true,
        passwordHash: ownerPasswordHash,
      },
      create: {
        email,
        name: 'Priyanshu',
        passwordHash: ownerPasswordHash,
        role: 'ADMIN',
        emailVerified: true,
        avatarColor: colorFor(email),
      },
    });
    console.log(`  ✓ owner      ${owner.email}  (ADMIN)`);
  }

  const admin = await prisma.user.upsert({
    where: { email: 'admin@ironcorefitness.example' },
    update: { role: 'ADMIN', emailVerified: true, isActive: true },
    create: {
      email: 'admin@ironcorefitness.example',
      name: 'Alex Rivera',
      passwordHash,
      role: 'ADMIN',
      emailVerified: true,
      phone: '+1 555 0100',
      avatarColor: colorFor('admin@ironcorefitness.example'),
    },
  });
  console.log(`  ✓ manager    ${admin.email}`);

  // --- 2. Staff -------------------------------------------------------------
  const staffUsers = [];
  for (const person of DEMO_STAFF) {
    const user = await prisma.user.upsert({
      where: { email: person.email },
      update: { role: 'STAFF', emailVerified: true, isActive: true },
      create: {
        email: person.email,
        name: person.name,
        passwordHash,
        role: 'STAFF',
        emailVerified: true,
        avatarColor: colorFor(person.email),
      },
    });
    await prisma.staffProfile.upsert({
      where: { userId: user.id },
      update: {
        title: person.title,
        specialties: person.specialties,
        isTrainer: person.isTrainer,
        certifications: person.certifications,
        maxOpenTickets: person.maxOpenTickets,
        isAvailable: true,
      },
      create: {
        userId: user.id,
        title: person.title,
        specialties: person.specialties,
        isTrainer: person.isTrainer,
        certifications: person.certifications,
        maxOpenTickets: person.maxOpenTickets,
      },
    });
    staffUsers.push(user);
    console.log(`  ✓ staff      ${user.email}  (${person.title})`);
  }

  // --- 3. Members + membership records + attendance -------------------------
  const members = [];
  for (const spec of DEMO_MEMBERS) {
    const user = await prisma.user.upsert({
      where: { email: spec.email },
      update: { emailVerified: true, isActive: true, phone: spec.phone },
      create: {
        email: spec.email,
        name: spec.name,
        passwordHash,
        role: 'MEMBER',
        emailVerified: true,
        phone: spec.phone,
        avatarColor: colorFor(spec.email),
      },
    });

    const joinedAt = new Date(Date.now() - spec.joinedMonthsAgo * 30 * 86_400_000);
    const profileData = {
      tier: spec.tier,
      status: spec.status,
      expiresAt:
        spec.expiresInDays === null ? null : new Date(Date.now() + spec.expiresInDays * 86_400_000),
      frozenUntil: spec.frozenUntilDays
        ? new Date(Date.now() + spec.frozenUntilDays * 86_400_000)
        : null,
      freezeReason: spec.freezeReason ?? null,
      goals: spec.goals ?? null,
      emergencyContactName: spec.emergencyContactName ?? null,
      emergencyContactPhone: spec.emergencyContactPhone ?? null,
      medicalNotes: spec.medicalNotes ?? null,
    };

    await prisma.memberProfile.upsert({
      where: { userId: user.id },
      update: profileData,
      create: { userId: user.id, memberNumber: spec.memberNumber, joinedAt, ...profileData },
    });

    // Attendance history powers the member context panel staff see on tickets.
    const existingCheckIns = await prisma.checkIn.count({ where: { memberId: user.id } });
    if (existingCheckIns === 0 && spec.visitsThisMonth > 0) {
      const now = new Date();
      const daysElapsed = Math.max(now.getDate() - 1, 1);
      await prisma.checkIn.createMany({
        data: Array.from({ length: spec.visitsThisMonth }, (_, i) => {
          const day = Math.max(1, Math.round(((i + 1) / spec.visitsThisMonth) * daysElapsed));
          return {
            memberId: user.id,
            at: new Date(now.getFullYear(), now.getMonth(), day, 7 + (i % 12), 15),
            source: 'TURNSTILE' as const,
          };
        }),
      });
    }

    members.push(user);
    console.log(`  ✓ member     ${user.email}  (${spec.memberNumber} · ${spec.tier} · ${spec.status})`);
  }

  const userByEmail = new Map([admin, ...staffUsers, ...members].map((u) => [u.email, u] as const));

  // --- 4. Classes + bookings ------------------------------------------------
  let bookingCount = 0;
  for (const spec of GYM_CLASSES) {
    const trainer = spec.trainerEmail ? userByEmail.get(spec.trainerEmail) : null;

    const existing = await prisma.gymClass.findFirst({
      where: { name: spec.name, dayOfWeek: spec.dayOfWeek, startTime: spec.startTime },
    });

    const gymClass = existing
      ? await prisma.gymClass.update({
          where: { id: existing.id },
          data: { description: spec.description, trainerId: trainer?.id ?? null, capacity: spec.capacity },
        })
      : await prisma.gymClass.create({
          data: {
            name: spec.name,
            description: spec.description,
            trainerId: trainer?.id ?? null,
            dayOfWeek: spec.dayOfWeek,
            startTime: spec.startTime,
            durationMins: spec.durationMins,
            capacity: spec.capacity,
            room: spec.room,
            intensity: spec.intensity,
          },
        });

    // Book active members into the next two occurrences of each class.
    const activeMembers = members.filter((_, index) => DEMO_MEMBERS[index].status === 'ACTIVE');
    for (const offset of [0, 7]) {
      const sessionDate = nextDateForWeekday(spec.dayOfWeek, offset + 1);
      for (const member of activeMembers) {
        // Deterministic spread so the timetable looks realistically uneven.
        if ((fnv1a(member.id + gymClass.id + offset) % 100) > 45) continue;
        try {
          await prisma.classBooking.create({
            data: {
              memberId: member.id,
              classId: gymClass.id,
              sessionDate,
              status: 'BOOKED',
            },
          });
          bookingCount += 1;
        } catch {
          // Unique constraint — already booked from a previous seed run.
        }
      }
    }
  }
  console.log(`\n  ✓ ${GYM_CLASSES.length} classes on the timetable (${bookingCount} bookings)`);

  // --- 5. SLA policies ------------------------------------------------------
  for (const policy of SLA_POLICIES) {
    await prisma.slaPolicy.upsert({
      where: { priority: policy.priority },
      update: {
        name: policy.name,
        firstResponseMins: policy.firstResponseMins,
        resolutionMins: policy.resolutionMins,
        escalateAfterMins: policy.escalateAfterMins,
        isActive: true,
        notifySlack: true,
      },
      create: { ...policy, notifySlack: true, isActive: true },
    });
  }
  console.log(`  ✓ ${SLA_POLICIES.length} SLA policies`);

  // --- 6. Knowledge base + embeddings --------------------------------------
  let chunkTotal = 0;
  for (const article of KB_ARTICLES) {
    const row = await prisma.kbArticle.upsert({
      where: { slug: article.slug },
      update: {
        title: article.title,
        summary: article.summary,
        content: article.content,
        category: article.category,
        tags: article.tags,
        isPublished: true,
        authorId: admin.id,
      },
      create: {
        title: article.title,
        slug: article.slug,
        summary: article.summary,
        content: article.content,
        category: article.category,
        tags: article.tags,
        authorId: admin.id,
        views: 10 + (fnv1a(article.slug) % 400),
      },
    });

    const chunks = chunkText(`${article.title}\n\n${article.summary}\n\n${article.content}`);
    const vectors = await embedTexts(chunks);
    await prisma.kbChunk.deleteMany({ where: { articleId: row.id } });
    for (let i = 0; i < chunks.length; i += 1) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "KbChunk" ("id","articleId","chunkIndex","content","embedding","createdAt")
         VALUES ($1,$2,$3,$4,$5::vector,NOW())`,
        cuidLike(),
        row.id,
        i,
        chunks[i],
        vectorLiteral(vectors[i]),
      );
    }
    chunkTotal += chunks.length;
  }
  console.log(`  ✓ ${KB_ARTICLES.length} knowledge base articles (${chunkTotal} embedded chunks)`);

  // --- 7. Tickets -----------------------------------------------------------
  let created = 0;
  let skipped = 0;

  for (const spec of DEMO_TICKETS) {
    const member = userByEmail.get(spec.memberEmail);
    if (!member) continue;

    const createdAt = new Date(Date.now() - spec.ageHours * 3_600_000);

    const duplicate = await prisma.ticket.findFirst({
      where: { memberId: member.id, subject: spec.subject },
    });
    if (duplicate) {
      skipped += 1;
      continue;
    }

    const assignee = spec.staffEmail ? userByEmail.get(spec.staffEmail) : undefined;
    const policy = await prisma.slaPolicy.findUnique({ where: { priority: spec.priority } });
    const minutes = SLA_MINUTES[spec.priority];
    const firstResponseMins = policy?.firstResponseMins ?? minutes.first;
    const resolutionMins = policy?.resolutionMins ?? minutes.resolve;

    const firstResponseDue = new Date(createdAt.getTime() + firstResponseMins * 60_000);
    const resolutionDue = new Date(createdAt.getTime() + resolutionMins * 60_000);
    const firstRespondedAt =
      spec.firstReplyAfterMins === null
        ? null
        : new Date(createdAt.getTime() + spec.firstReplyAfterMins * 60_000);

    const lastReplyMins = spec.replies?.length
      ? Math.max(...spec.replies.map((r) => r.afterMins))
      : (spec.firstReplyAfterMins ?? 0);
    const resolvedAt =
      spec.status === 'RESOLVED' || spec.status === 'CLOSED'
        ? new Date(createdAt.getTime() + (lastReplyMins + 20) * 60_000)
        : null;

    const ticket = await prisma.ticket.create({
      data: {
        subject: spec.subject,
        body: spec.body,
        status: spec.status,
        priority: spec.priority,
        category: spec.category,
        memberId: member.id,
        assigneeId: assignee?.id ?? null,
        autoAssigned: Boolean(assignee),
        safetyFlag: Boolean(spec.safetyFlag),
        aiSummary: spec.summary,
        aiSentiment: spec.sentiment,
        aiConfidence: spec.confidence,
        aiTags: spec.tags,
        aiEngine: 'LOCAL_FALLBACK',
        aiTriagedAt: new Date(createdAt.getTime() + 4_000),
        slaPolicyId: policy?.id ?? null,
        firstResponseDue,
        resolutionDue,
        firstRespondedAt,
        resolvedAt,
        closedAt: spec.status === 'CLOSED' ? resolvedAt : null,
        firstResponseBreached: Boolean(
          firstRespondedAt ? firstRespondedAt > firstResponseDue : new Date() > firstResponseDue,
        ),
        resolutionBreached: Boolean(
          resolvedAt ? resolvedAt > resolutionDue : new Date() > resolutionDue,
        ),
        satisfaction: spec.satisfaction ?? null,
        createdAt,
        updatedAt: new Date(createdAt.getTime() + (lastReplyMins + 5) * 60_000),
      },
    });

    await prisma.message.create({
      data: {
        ticketId: ticket.id,
        authorId: member.id,
        authorType: 'MEMBER',
        body: spec.body,
        createdAt,
      },
    });

    await prisma.ticketEvent.createMany({
      data: [
        {
          ticketId: ticket.id,
          actorId: member.id,
          type: 'created',
          summary: `Ticket created by ${member.name}`,
          createdAt,
        },
        {
          ticketId: ticket.id,
          type: 'ai_triaged',
          summary: `AI triage: ${spec.category.replace(/_/g, ' ').toLowerCase()} · ${spec.priority.toLowerCase()} priority · ${spec.sentiment.toLowerCase()} sentiment (${Math.round(spec.confidence * 100)}% confidence)`,
          toValue: `${spec.category}/${spec.priority}`,
          createdAt: new Date(createdAt.getTime() + 4_000),
        },
        ...(spec.safetyFlag
          ? [
              {
                ticketId: ticket.id,
                type: 'escalated',
                summary: 'Safety signal detected by AI triage — escalated immediately for review',
                toValue: 'SAFETY_RISK',
                createdAt: new Date(createdAt.getTime() + 5_000),
              },
            ]
          : []),
        ...(assignee
          ? [
              {
                ticketId: ticket.id,
                type: 'assigned',
                summary: `Auto-assigned to ${assignee.name} (specialty match)`,
                toValue: assignee.name,
                createdAt: new Date(createdAt.getTime() + 6_000),
              },
            ]
          : []),
      ],
    });

    for (const reply of spec.replies ?? []) {
      const author = reply.from === 'staff' ? assignee : member;
      await prisma.message.create({
        data: {
          ticketId: ticket.id,
          authorId: author?.id ?? null,
          authorType: reply.from === 'staff' ? 'STAFF' : 'MEMBER',
          body: reply.body,
          createdAt: new Date(createdAt.getTime() + reply.afterMins * 60_000),
        },
      });
    }

    // A reviewable AI draft on tickets that have no staff reply yet.
    if (!spec.replies || spec.replies.length === 0) {
      const related = await prisma.kbArticle.findFirst({
        where: { category: spec.category, isPublished: true },
      });
      await prisma.aiSuggestion.create({
        data: {
          ticketId: ticket.id,
          draft: buildSeedDraft(member.name, spec.subject, related?.title ?? null, spec.priority),
          confidence: Number((spec.confidence * 0.8).toFixed(2)),
          engine: 'LOCAL_FALLBACK',
          model: 'local-retrieval-template-v1',
          citations: related
            ? ([
                {
                  articleId: related.id,
                  title: related.title,
                  slug: related.slug,
                  similarity: 0.68,
                  used: true,
                },
              ] as unknown as Prisma.InputJsonValue)
            : ([] as unknown as Prisma.InputJsonValue),
          latencyMs: 320 + (fnv1a(spec.subject) % 700),
          createdAt: new Date(createdAt.getTime() + 8_000),
        },
      });
    }

    // Safety escalation, recorded at creation time rather than on a timer.
    if (spec.safetyFlag) {
      await prisma.escalation.create({
        data: {
          ticketId: ticket.id,
          reason: 'SAFETY_RISK',
          level: 2,
          status: spec.status === 'RESOLVED' || spec.status === 'CLOSED' ? 'RESOLVED' : 'OPEN',
          detail: `Safety signal detected by AI triage on arrival: ${spec.summary}`,
          slackNotified: false,
          slackError: 'SLACK_WEBHOOK_URL not configured during seed',
          createdAt: new Date(createdAt.getTime() + 5_000),
          resolvedAt: resolvedAt,
        },
      });
    }

    // SLA breach escalation for anything that actually missed first response.
    if (!firstRespondedAt && new Date() > firstResponseDue) {
      const overdueMins = Math.round((Date.now() - firstResponseDue.getTime()) / 60_000);
      await prisma.escalation.create({
        data: {
          ticketId: ticket.id,
          reason: 'FIRST_RESPONSE_BREACH',
          level: 1,
          status: 'OPEN',
          detail: `First response SLA breached by ${overdueMins} minutes (target ${firstResponseMins}m for ${spec.priority}).`,
          slackNotified: false,
          slackError: 'SLACK_WEBHOOK_URL not configured during seed',
          createdAt: new Date(firstResponseDue.getTime() + 60_000),
        },
      });
      await prisma.ticketEvent.create({
        data: {
          ticketId: ticket.id,
          type: 'escalated',
          summary: 'First response SLA breached — escalation level 1',
          toValue: 'L1',
          createdAt: new Date(firstResponseDue.getTime() + 60_000),
        },
      });
    }

    if (spec.status === 'RESOLVED' || spec.status === 'CLOSED') {
      await prisma.ticketEvent.create({
        data: {
          ticketId: ticket.id,
          actorId: assignee?.id ?? null,
          type: 'status_changed',
          summary: `Status changed to ${spec.status.toLowerCase()}`,
          fromValue: 'IN_PROGRESS',
          toValue: spec.status,
          createdAt: resolvedAt ?? new Date(),
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        actorId: member.id,
        actorEmail: member.email,
        action: 'ticket.created',
        entityType: 'Ticket',
        entityId: ticket.id,
        detail: `#${ticket.number} — ${spec.subject}`,
        metadata: { seeded: true, priority: spec.priority, category: spec.category },
        createdAt,
      },
    });

    created += 1;
  }
  console.log(`  ✓ ${created} tickets created${skipped ? ` (${skipped} already existed, skipped)` : ''}`);

  // --- 8. Demo payments -----------------------------------------------------
  const paymentPlans = [
    { plan: 'ELITE', amountCents: 12900, cardLast4: '4242', cardBrand: 'Visa', status: 'SUCCEEDED' as const },
    { plan: 'PRO', amountCents: 5900, cardLast4: '5556', cardBrand: 'Mastercard', status: 'SUCCEEDED' as const },
    { plan: 'BASIC', amountCents: 2900, cardLast4: '0002', cardBrand: 'Visa', status: 'FAILED' as const },
  ];
  for (let i = 0; i < paymentPlans.length; i += 1) {
    const spec = paymentPlans[i];
    const member = members[i % members.length];
    const reference = `DEMO-${spec.plan}-${member.id.slice(-6).toUpperCase()}`;
    await prisma.payment.upsert({
      where: { reference },
      update: {},
      create: {
        userId: member.id,
        plan: spec.plan,
        amountCents: spec.amountCents,
        currency: 'USD',
        status: spec.status,
        reference,
        cardLast4: spec.cardLast4,
        cardBrand: spec.cardBrand,
        failureCode: spec.status === 'FAILED' ? 'card_declined' : null,
        isDemo: true,
        createdAt: new Date(Date.now() - (i + 1) * 86_400_000),
      },
    });
  }
  console.log(`  ✓ ${paymentPlans.length} demo payment records (DEMO PAYMENT — NO REAL MONEY)`);

  // --- 9. Welcome notifications --------------------------------------------
  if ((await prisma.notification.count()) === 0) {
    await prisma.notification.createMany({
      data: [
        {
          userId: admin.id,
          title: 'Welcome to IronCore Fitness',
          body: 'Demo data is loaded. Open Analytics for a live view of the member support queue.',
          link: '/admin/analytics',
          level: 'info',
        },
        ...staffUsers.map((person) => ({
          userId: person.id,
          title: 'Your queue is ready',
          body: 'Tickets have been auto-assigned by AI triage. Review the drafted replies before sending.',
          link: '/staff',
          level: 'info',
        })),
      ],
    });
  }

  const [ticketCount, openCount, escalationCount, classCount, checkInCount] = await Promise.all([
    prisma.ticket.count(),
    prisma.ticket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS', 'PENDING_MEMBER'] } } }),
    prisma.escalation.count(),
    prisma.gymClass.count(),
    prisma.checkIn.count(),
  ]);

  console.log(`
─────────────────────────────────────────────────────────────
  IronCore Fitness — seed complete

  Tickets: ${ticketCount} (${openCount} open) · Escalations: ${escalationCount}
  Timetable: ${classCount} classes · Check-ins logged: ${checkInCount}
  Knowledge base: ${KB_ARTICLES.length} articles, ${chunkTotal} vector chunks
  AI engine: ${process.env.OPENAI_API_KEY ? 'OpenAI embeddings' : 'local vectoriser (no OPENAI_API_KEY)'}

  Sign in with password: ${DEMO_PASSWORD}

    YOUR ADMIN  ${ownerEmails.join('\n    YOUR ADMIN  ')}
    Manager   admin@ironcorefitness.example
    Staff     maya.chen@ironcorefitness.example      (membership & accounts)
    Staff     omar.haddad@ironcorefitness.example    (PT, injury & nutrition)
    Staff     elena.novak@ironcorefitness.example    (classes)
    Staff     tomas.berg@ironcorefitness.example     (equipment & facilities)
    Member    priya.raman@example.com                (IC-00412 · Elite)
    Member    sofia.marino@example.com               (IC-00298 · Pro, frozen)
    Member    lucas.pereira@example.com              (IC-00702 · Basic, expired)
─────────────────────────────────────────────────────────────
`);
}

function buildSeedDraft(
  memberName: string,
  subject: string,
  articleTitle: string | null,
  priority: TicketPriority,
): string {
  const firstName = memberName.split(' ')[0];
  const source = articleTitle
    ? `Based on our guide "${articleTitle}", here is what applies to your case — I've checked it against your membership before replying.`
    : `I haven't found an existing article that covers this exactly, so I'm confirming the details with the team.`;
  const close =
    priority === 'URGENT' || priority === 'HIGH'
      ? `I've flagged this as ${priority.toLowerCase()} priority and we're staying on it until it's resolved.`
      : `If that doesn't sort it, reply here and I'll pick it straight back up.`;

  return `Hi ${firstName}, thanks for getting in touch about "${subject}".\n\n${source}\n\n${close}\n\nBest,\nthe IronCore team`;
}

main()
  .catch((error) => {
    console.error('\n✖ Seed failed:\n', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

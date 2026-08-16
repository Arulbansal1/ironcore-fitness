import { recordAudit, recordTicketEvent } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { ApiError, clientIp, ok, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { getTicketForUser } from '@/lib/tickets';
import { storeUpload } from '@/lib/uploads';

type Params = { params: Promise<{ id: string }> };

const MAX_FILES_PER_REQUEST = 5;

/**
 * Multipart upload of one or more attachments against a ticket.
 * Files land in a private directory and are served only through
 * GET /api/attachments/[id], which re-checks access.
 */
export const POST = route(async (request: Request, context: Params) => {
  const { id } = await context.params;
  const user = await requireUser();
  const ticket = await getTicketForUser(id, user);

  if (ticket.status === 'CLOSED') {
    throw ApiError.badRequest('This ticket is closed. Reopen it before adding attachments.');
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw ApiError.badRequest('Expected a multipart/form-data upload.');
  }

  const files = form.getAll('files').filter((entry): entry is File => entry instanceof File);
  const messageId = form.get('messageId');

  if (files.length === 0) throw ApiError.badRequest('Choose at least one file to upload.');
  if (files.length > MAX_FILES_PER_REQUEST) {
    throw ApiError.badRequest(`You can upload at most ${MAX_FILES_PER_REQUEST} files at once.`);
  }

  if (typeof messageId === 'string' && messageId) {
    const message = await prisma.message.findFirst({
      where: { id: messageId, ticketId: id },
      select: { id: true },
    });
    if (!message) throw ApiError.badRequest('That message does not belong to this ticket.');
  }

  const created = [];
  for (const file of files) {
    const stored = await storeUpload(file);
    const attachment = await prisma.attachment.create({
      data: {
        ticketId: id,
        messageId: typeof messageId === 'string' && messageId ? messageId : null,
        uploaderId: user.id,
        filename: stored.filename,
        storedName: stored.storedName,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        data: stored.data,
      },
      select: { id: true, filename: true, mimeType: true, sizeBytes: true, createdAt: true },
    });
    created.push(attachment);
  }

  await recordTicketEvent({
    ticketId: id,
    actorId: user.id,
    type: 'attachment_added',
    summary: `${user.name} attached ${created.length} file${created.length === 1 ? '' : 's'}: ${created
      .map((a) => a.filename)
      .join(', ')}`,
  });

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'ticket.attachment_uploaded',
    entityType: 'Ticket',
    entityId: id,
    detail: created.map((a) => a.filename).join(', '),
    metadata: { count: created.length },
    ip: clientIp(request),
  });

  return ok(
    {
      message: `Uploaded ${created.length} file${created.length === 1 ? '' : 's'}.`,
      attachments: created,
    },
    201,
  );
});

export const GET = route(async (request: Request, context: Params) => {
  const { id } = await context.params;
  const user = await requireUser();
  await getTicketForUser(id, user);

  const attachments = await prisma.attachment.findMany({
    where: { ticketId: id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
      uploader: { select: { id: true, name: true } },
    },
  });

  return ok({ attachments });
});

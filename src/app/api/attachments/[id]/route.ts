import type { ReadStream } from 'node:fs';

import { requireUser } from '@/lib/auth';
import { ApiError, route } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { readStoredFile } from '@/lib/uploads';

type Params = { params: Promise<{ id: string }> };

/**
 * Authenticated attachment download.
 * Uploads are stored outside `public/`, so this route is the only way to read
 * one — and it re-checks that the caller may see the parent ticket.
 */
export const GET = route(async (request: Request, context: Params) => {
  const { id } = await context.params;
  const user = await requireUser();

  const attachment = await prisma.attachment.findUnique({
    where: { id },
    include: { ticket: { select: { id: true, memberId: true } } },
  });

  if (!attachment) throw ApiError.notFound('That attachment does not exist.');

  const isStaff = user.role === 'STAFF' || user.role === 'ADMIN';
  if (!isStaff && attachment.ticket.memberId !== user.id) {
    throw ApiError.notFound('That attachment does not exist.');
  }

  const disposition = new URL(request.url).searchParams.get('download') === '1' ? 'attachment' : 'inline';

  // Bytes live either in the database (serverless) or on disk (self-hosted).
  const body: BodyInit = attachment.data
    ? new Uint8Array(attachment.data)
    : nodeStreamToWeb(await readStoredFile(attachment.storedName));

  return new Response(body, {
    headers: {
      'content-type': attachment.mimeType,
      'content-length': String(attachment.sizeBytes),
      'content-disposition': `${disposition}; filename="${encodeURIComponent(attachment.filename)}"`,
      // Attachments are private: never let a shared cache hold them.
      'cache-control': 'private, max-age=0, must-revalidate',
      'x-content-type-options': 'nosniff',
    },
  });
});

function nodeStreamToWeb(stream: ReadStream): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      stream.on('data', (chunk) => controller.enqueue(new Uint8Array(chunk as Buffer)));
      stream.on('end', () => controller.close());
      stream.on('error', (error) => controller.error(error));
    },
    cancel() {
      stream.destroy();
    },
  });
}

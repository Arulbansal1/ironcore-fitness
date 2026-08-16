import 'server-only';

import { createReadStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { env } from './env';
import { ApiError } from './http';

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'application/zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export const ALLOWED_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.txt', '.csv',
  '.json', '.zip', '.doc', '.docx', '.xls', '.xlsx',
];

function uploadRoot(): string {
  return path.isAbsolute(env.uploadDir) ? env.uploadDir : path.join(process.cwd(), env.uploadDir);
}

/**
 * Serverless platforms give each invocation a fresh, mostly read-only
 * filesystem, so a file written to disk during one request is simply gone on the
 * next. On Vercel (and anywhere else with no persistent disk) attachment bytes
 * are stored in Postgres instead.
 *
 * That is a deliberate trade: it keeps deployment to a single service with no
 * object store to configure, at the cost of holding binaries in the database.
 * With a 10 MB cap and support-ticket volumes that is fine; a high-volume
 * deployment should move to object storage and set STORAGE_DRIVER=disk with a
 * mounted volume.
 */
export function usesDatabaseStorage(): boolean {
  const driver = process.env.STORAGE_DRIVER;
  if (driver === 'database') return true;
  if (driver === 'disk') return false;
  return Boolean(process.env.VERCEL);
}

export type StoredFile = {
  storedName: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  /** Set only when the bytes are stored in the database rather than on disk. */
  data: Uint8Array<ArrayBuffer> | null;
};

/**
 * Validates and writes an uploaded file to the private uploads directory.
 * Files are served back only through the authenticated /api/attachments route.
 */
export async function storeUpload(file: File): Promise<StoredFile> {
  if (file.size === 0) throw ApiError.badRequest(`"${file.name}" is empty.`);
  if (file.size > env.maxUploadBytes) {
    throw ApiError.badRequest(
      `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ${(env.maxUploadBytes / 1024 / 1024).toFixed(0)} MB.`,
    );
  }

  const extension = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    throw ApiError.badRequest(
      `"${file.name}" has an unsupported type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
    );
  }
  // The extension allowlist above is the real gate. Clients are unreliable about
  // the MIME type for .csv/.zip/.docx and frequently send a generic
  // application/octet-stream, so that value is accepted rather than rejected.
  const genericTypes = new Set(['', 'application/octet-stream', 'binary/octet-stream']);
  if (!genericTypes.has(file.type) && !ALLOWED_MIME.has(file.type)) {
    throw ApiError.badRequest(
      `"${file.name}" has an unsupported content type (${file.type}).`,
    );
  }

  // Copy into a plain ArrayBuffer-backed view: Prisma's Bytes field is typed
  // Uint8Array<ArrayBuffer>, and Node's Buffer is backed by ArrayBufferLike.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const storedName = `${Date.now().toString(36)}-${crypto.randomUUID()}${extension}`;

  if (usesDatabaseStorage()) {
    return {
      storedName: '',
      filename: sanitizeFilename(file.name),
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: bytes.byteLength,
      data: bytes,
    };
  }

  const dir = uploadRoot();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, storedName), bytes);

  return {
    storedName,
    filename: sanitizeFilename(file.name),
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: bytes.byteLength,
    data: null,
  };
}

/** Resolves a stored file path, refusing anything that escapes the upload root. */
export function resolveStoredPath(storedName: string): string {
  const root = uploadRoot();
  const resolved = path.resolve(root, storedName);
  if (!resolved.startsWith(path.resolve(root) + path.sep)) {
    throw ApiError.forbidden('Invalid file path.');
  }
  return resolved;
}

export async function readStoredFile(storedName: string) {
  const filePath = resolveStoredPath(storedName);
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error('not a file');
    return createReadStream(filePath);
  } catch {
    throw ApiError.notFound('That attachment is no longer available on disk.');
  }
}

export async function deleteStoredFile(storedName: string) {
  try {
    await unlink(resolveStoredPath(storedName));
  } catch {
    /* already gone — nothing to do */
  }
}

function sanitizeFilename(name: string): string {
  return path.basename(name).replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'attachment';
}

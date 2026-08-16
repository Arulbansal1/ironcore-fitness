/**
 * Production entry point.
 *
 * The Next.js standalone server calls `process.chdir(__dirname)` before it
 * boots, which silently moves the working directory to `.next/standalone`. Any
 * relative path in the app — most importantly `UPLOAD_DIR=./uploads` — would
 * then resolve somewhere unexpected, and attachments written in development
 * would be invisible in production.
 *
 * Resolving those paths to absolute values here, against the real project root,
 * keeps `npm run dev` and `npm start` reading and writing the same directory.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!path.isAbsolute(uploadDir)) {
  process.env.UPLOAD_DIR = path.resolve(root, uploadDir);
}

const server = path.join(root, '.next', 'standalone', 'server.js');
if (!existsSync(server)) {
  console.error(
    '✖ No production build found at .next/standalone/server.js\n  Run `npm run build` first.',
  );
  process.exit(1);
}

console.log(`▸ Uploads directory: ${process.env.UPLOAD_DIR}`);
await import(server);

/**
 * Post-build step for `output: 'standalone'`.
 *
 * Next.js writes a self-contained server to `.next/standalone` but deliberately
 * does NOT copy `.next/static` or `public/` into it — those are expected to be
 * served by a CDN in a typical deployment. Running the standalone server without
 * them produces a page with no CSS and no JavaScript, which is a confusing way to
 * discover the problem.
 *
 * Copying them here makes `npm start` work identically to `npm run dev`.
 */
import { cp, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const standalone = path.join(root, '.next', 'standalone');

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await exists(standalone))) {
    console.log('▸ No standalone output found — skipping (this is fine for a non-standalone build).');
    return;
  }

  const staticSrc = path.join(root, '.next', 'static');
  const staticDest = path.join(standalone, '.next', 'static');
  if (await exists(staticSrc)) {
    await mkdir(path.dirname(staticDest), { recursive: true });
    await cp(staticSrc, staticDest, { recursive: true });
    console.log('▸ Copied .next/static into the standalone bundle');
  }

  const publicSrc = path.join(root, 'public');
  const publicDest = path.join(standalone, 'public');
  if (await exists(publicSrc)) {
    await cp(publicSrc, publicDest, { recursive: true });
    console.log('▸ Copied public/ into the standalone bundle');
  }

  console.log('▸ Standalone bundle ready — start it with `npm start`');
}

main().catch((error) => {
  console.error('✖ Failed to prepare the standalone bundle:', error);
  process.exit(1);
});

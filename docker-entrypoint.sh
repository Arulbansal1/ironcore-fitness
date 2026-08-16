#!/bin/sh
set -e

echo "▸ Applying database schema..."
npx prisma db push --skip-generate --accept-data-loss

if [ "${SKIP_SEED}" != "true" ]; then
  echo "▸ Seeding demo data (set SKIP_SEED=true to disable)..."
  npx tsx prisma/seed.ts || echo "⚠ Seed skipped or already applied."
fi

echo "▸ Starting Next.js on port ${PORT:-3000}"
exec "$@"

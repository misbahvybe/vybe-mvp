/**
 * Prisma schema uses directUrl = env("DIRECT_URL"). If unset (e.g. Railway),
 * default to DATABASE_URL so migrate deploy / generate validate (Neon: set
 * DIRECT_URL to the non-pooler host separately to avoid P1002 on migrations).
 */
const { spawnSync } = require('child_process');

function looksLikePrismaShadowDb(url) {
  return typeof url === 'string' && url.includes('prisma_migrate_shadow_db');
}

for (const [key, url] of [
  ['DATABASE_URL', process.env.DATABASE_URL],
  ['DIRECT_URL', process.env.DIRECT_URL],
]) {
  if (looksLikePrismaShadowDb(url)) {
    console.error(
      [
        `ERROR: ${key} points at a Prisma *shadow* database (name contains prisma_migrate_shadow_db).`,
        'That URL is only for prisma migrate dev; do not use it on Railway.',
        'In Neon → your branch → Connection details, use database name neondb (or your real DB),',
        'and set DIRECT_URL to the direct (non-pooler) host — not a shadow DB connection string.',
      ].join('\n'),
    );
    process.exit(1);
  }
}

if (!String(process.env.DIRECT_URL ?? '').trim() && String(process.env.DATABASE_URL ?? '').trim()) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('usage: node scripts/ensure-direct-url.cjs <command> [args...]');
  process.exit(1);
}

const result = spawnSync(args[0], args.slice(1), {
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
});

process.exit(result.status === null ? 1 : result.status);

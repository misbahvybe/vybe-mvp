/**
 * Prisma schema uses directUrl = env("DIRECT_URL"). If unset (e.g. Railway),
 * default to DATABASE_URL so migrate deploy / generate validate (Neon: set
 * DIRECT_URL to the non-pooler host separately to avoid P1002 on migrations).
 */
const { spawnSync } = require('child_process');

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

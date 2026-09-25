/**
 * Runs a command (e.g. `npx prisma migrate dev`) with DATABASE_URL injected
 * into its environment, built from DB_HOST/DB_USER/DB_PASSWORD/DB_NAME in .env.
 * Needed because Prisma's own CLI only understands DATABASE_URL directly.
 *
 * Usage: node scripts/with-db-url.js <command> [...args]
 */
import 'dotenv/config';
import { spawn } from 'node:child_process';
import { buildDatabaseUrl } from '../src/config/database-url.js';

let databaseUrl;
try {
  databaseUrl = buildDatabaseUrl();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const [cmd, ...args] = process.argv.slice(2);

if (!cmd) {
  console.error('Usage: node scripts/with-db-url.js <command> [...args]');
  process.exit(1);
}

const child = spawn(cmd, args, {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, DATABASE_URL: databaseUrl },
});

child.on('exit', (code) => process.exit(code ?? 0))
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const dbPath = join(process.cwd(), 'prisma', 'test-ai.db');
const databaseUrl = `file:${dbPath.replace(/\\/g, '/')}`;
const env = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: databaseUrl,
  AI_PROVIDER: 'test',
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || 'test',
};

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (existsSync(dbPath)) rmSync(dbPath, { force: true });
if (existsSync(`${dbPath}-journal`)) rmSync(`${dbPath}-journal`, { force: true });

run('npx', ['prisma', 'generate']);
run('npx', ['prisma', 'db', 'push', '--skip-generate']);
run('npm', ['run', 'build']);
run('node', ['--test', 'dist/modules/ai/__tests__/*.test.js']);

if (existsSync(dbPath)) rmSync(dbPath, { force: true });
if (existsSync(`${dbPath}-journal`)) rmSync(`${dbPath}-journal`, { force: true });

import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { loadBackendEnv } from '../../lib/load-backend-env.mjs';

loadBackendEnv({ backendRoot: process.cwd() });

function readTokenFromFile() {
  const tokenPath = path.resolve(process.cwd(), '.test-auth-token');
  if (!fs.existsSync(tokenPath)) return '';
  return fs.readFileSync(tokenPath, 'utf8').trim();
}

function ensureToken() {
  if (process.env.TEST_TOKEN?.trim()) return process.env.TEST_TOKEN.trim();
  const existing = readTokenFromFile();
  if (existing) return existing;

  const result = spawnSync('npm', ['run', 'test:token'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      TEST_TELEGRAM_ID: process.env.TEST_TELEGRAM_ID || '516730814',
      TEST_ADMIN: process.env.TEST_ADMIN || '1',
    },
  });

  if (result.status !== 0) {
    throw new Error('Cannot create test token. Check npm run test:token.');
  }

  const created = readTokenFromFile();
  if (!created) throw new Error('Test token file was not created: .test-auth-token');
  return created;
}

export function createSmokeContext(scope = 'smoke') {
  const baseUrl = (process.env.TEST_BASE_URL || process.env.API_BASE_URL || 'http://localhost:3000/api').replace(/\/$/, '');
  const token = ensureToken();
  const suffix = `${scope}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    baseUrl,
    token,
    suffix,
    log(message, data) {
      if (data === undefined) console.log(`[${scope}] ${message}`);
      else console.log(`[${scope}] ${message}`, data);
    },
  };
}

export async function runSmoke(name, fn) {
  const started = Date.now();
  try {
    const context = createSmokeContext(name);
    context.log(`start: ${context.baseUrl}`);
    await fn(context);
    console.log(`✓ ${name} passed (${Date.now() - started}ms)`);
  } catch (error) {
    console.error(`✕ ${name} failed (${Date.now() - started}ms)`);
    console.error(error?.stack || error);
    if (error?.details) console.error(JSON.stringify(error.details, null, 2));
    process.exitCode = 1;
  }
}

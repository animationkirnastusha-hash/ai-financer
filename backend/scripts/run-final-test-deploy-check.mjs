import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const stopOnFail = process.env.FINAL_CHECK_STOP_ON_FAIL !== '0';
const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000/api';
const checks = [];
let failed = false;

function printHeader(title) {
  console.log(`\n=== ${title} ===`);
}

function run(command, args, options = {}) {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, {
      cwd: options.cwd || root,
      env: { ...process.env, ...(options.env || {}) },
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('close', (code) => resolveRun(code ?? 1));
    child.on('error', (error) => {
      console.error(error);
      resolveRun(1);
    });
  });
}

async function check(name, fn) {
  printHeader(name);
  const started = Date.now();
  try {
    const code = await fn();
    if (code === 0) {
      checks.push({ name, ok: true, ms: Date.now() - started });
      console.log(`✓ ${name} passed (${Date.now() - started}ms)`);
      return;
    }
    throw new Error(`${name} exited with code ${code}`);
  } catch (error) {
    failed = true;
    checks.push({ name, ok: false, ms: Date.now() - started, error: error?.message || String(error) });
    console.error(`✕ ${name} failed (${Date.now() - started}ms)`);
    console.error(error);
    if (stopOnFail) process.exit(1);
  }
}

function assertBackendContext() {
  const packageJson = resolve(root, 'package.json');
  const prismaSchema = resolve(root, 'prisma/schema.prisma');
  if (!existsSync(packageJson) || !existsSync(prismaSchema)) {
    throw new Error('Run this script from backend root. Example: cd /root/ai-financer/backend');
  }
  const pkg = JSON.parse(readFileSync(packageJson, 'utf8'));
  const requiredScripts = [
    'build',
    'smoke:full',
    'smoke:taxonomy-autocategory',
    'smoke:receipt-taxonomy',
    'audit:final',
  ];
  const missing = requiredScripts.filter((name) => !pkg.scripts?.[name]);
  if (missing.length) {
    throw new Error(`backend package.json is missing scripts: ${missing.join(', ')}`);
  }
}

console.log('AI-Financer final test deploy check');
console.log(`Backend root: ${root}`);
console.log(`Base URL: ${baseUrl}`);
console.log(`Stop on fail: ${stopOnFail ? 'yes' : 'no'}`);

try {
  assertBackendContext();
} catch (error) {
  console.error(error);
  process.exit(1);
}

await check('backend build', () => run('npm', ['run', 'build']));
await check('final backend audit', () => run('npm', ['run', 'audit:final']));
await check('prisma migrate status', () => run('npx', ['prisma', 'migrate', 'status']));
await check('test token', () => run('npm', ['run', 'test:token'], {
  env: {
    TEST_TELEGRAM_ID: process.env.TEST_TELEGRAM_ID || '516730814',
    TEST_ADMIN: process.env.TEST_ADMIN || '1',
  },
}));
await check('full backend smoke', () => run('npm', ['run', 'smoke:full'], {
  env: {
    TEST_BASE_URL: baseUrl,
    SMOKE_STOP_ON_FAIL: process.env.SMOKE_STOP_ON_FAIL || '0',
  },
}));

printHeader('summary');
for (const item of checks) {
  console.log(`${item.ok ? '✓' : '✕'} ${item.name} (${item.ms}ms)${item.error ? ` — ${item.error}` : ''}`);
}

if (failed) {
  console.error('\nFinal test deploy check failed. Fix failed checks before test deploy.');
  process.exit(1);
}

console.log('\nFinal test deploy check passed. Backend is ready for test deploy checks.');

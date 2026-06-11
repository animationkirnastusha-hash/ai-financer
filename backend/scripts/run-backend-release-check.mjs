#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const stopOnFail = process.env.RELEASE_CHECK_STOP_ON_FAIL !== '0';
const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000/api';
const reportDir = path.resolve(root, 'reports/backend-release-check');
const jsonReportPath = path.join(reportDir, 'release-check.json');
const markdownReportPath = path.join(reportDir, 'release-check.md');
const checks = [];
let failed = false;

function printHeader(title) {
  console.log(`\n=== ${title} ===`);
}

function ensureBackendContext() {
  const packageJson = path.resolve(root, 'package.json');
  const prismaSchema = path.resolve(root, 'prisma/schema.prisma');
  if (!fs.existsSync(packageJson) || !fs.existsSync(prismaSchema)) {
    throw new Error('Run this script from backend root. Example: cd /root/ai-financer/backend');
  }

  const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
  const requiredScripts = [
    'build',
    'repo:clean',
    'audit:final',
    'test:token',
    'smoke:predeploy',
    'smoke:monetization',
  ];
  const missing = requiredScripts.filter((name) => !pkg.scripts?.[name]);
  if (missing.length) {
    throw new Error(`backend package.json is missing scripts: ${missing.join(', ')}`);
  }
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

async function check(name, fn, meta = {}) {
  printHeader(name);
  const started = Date.now();
  try {
    const code = await fn();
    const durationMs = Date.now() - started;
    if (code === 0) {
      checks.push({ name, ok: true, durationMs, ...meta });
      console.log(`✓ ${name} passed (${durationMs}ms)`);
      return;
    }
    throw new Error(`${name} exited with code ${code}`);
  } catch (error) {
    const durationMs = Date.now() - started;
    failed = true;
    checks.push({ name, ok: false, durationMs, error: error?.message || String(error), ...meta });
    console.error(`✕ ${name} failed (${durationMs}ms)`);
    console.error(error);
    if (stopOnFail) {
      writeReport();
      process.exit(1);
    }
  }
}

function writeReport() {
  fs.mkdirSync(reportDir, { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    backendRoot: root,
    baseUrl,
    stopOnFail,
    ok: !failed,
    checks,
  };

  fs.writeFileSync(jsonReportPath, `${JSON.stringify(payload, null, 2)}\n`);

  const lines = [
    '# AI-Financer backend release check',
    '',
    `Generated: ${payload.generatedAt}`,
    `Backend root: ${root}`,
    `Base URL: ${baseUrl}`,
    `Result: ${payload.ok ? 'passed' : 'failed'}`,
    '',
    '| Check | Result | Time |',
    '| --- | --- | ---: |',
    ...checks.map((item) => `| ${item.name} | ${item.ok ? 'passed' : `failed: ${item.error || 'error'}`} | ${item.durationMs}ms |`),
    '',
  ];
  fs.writeFileSync(markdownReportPath, `${lines.join('\n')}\n`);
}

console.log('AI-Financer backend release check');
console.log(`Backend root: ${root}`);
console.log(`Base URL: ${baseUrl}`);
console.log(`Stop on fail: ${stopOnFail ? 'yes' : 'no'}`);

try {
  ensureBackendContext();
} catch (error) {
  console.error(error);
  process.exit(1);
}

await check('repository cleanup', () => run('npm', ['run', 'repo:clean']));
await check('backend build', () => run('npm', ['run', 'build']));
await check('final backend audit', () => run('npm', ['run', 'audit:final']));
await check('prisma migrate status', () => run('npx', ['prisma', 'migrate', 'status']));
await check('test token', () => run('npm', ['run', 'test:token'], {
  env: {
    TEST_TELEGRAM_ID: process.env.TEST_TELEGRAM_ID || '516730814',
    TEST_ADMIN: process.env.TEST_ADMIN || '1',
  },
}));
await check('predeploy smoke', () => run('npm', ['run', 'smoke:predeploy'], {
  env: {
    TEST_BASE_URL: baseUrl,
    SMOKE_STOP_ON_FAIL: process.env.SMOKE_STOP_ON_FAIL || '0',
  },
}));
await check('monetization smoke', () => run('npm', ['run', 'smoke:monetization'], {
  env: {
    TEST_BASE_URL: baseUrl,
    SMOKE_STOP_ON_FAIL: process.env.SMOKE_STOP_ON_FAIL || '0',
  },
}));

writeReport();

printHeader('summary');
for (const item of checks) {
  console.log(`${item.ok ? '✓' : '✕'} ${item.name} (${item.durationMs}ms)${item.error ? ` — ${item.error}` : ''}`);
}
console.log(`\nReport: ${path.relative(root, markdownReportPath)}`);

if (failed) {
  console.error('\nBackend release check failed. Fix failed checks before deploy.');
  process.exit(1);
}

console.log('\nBackend release check passed.');

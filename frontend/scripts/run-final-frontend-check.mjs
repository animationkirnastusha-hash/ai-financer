import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const stopOnFail = process.env.FINAL_CHECK_STOP_ON_FAIL !== '0';
const checks = [];
let failed = false;

function run(command, args) {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, {
      cwd: root,
      env: process.env,
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
  console.log(`\n=== ${name} ===`);
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

function assertFrontendContext() {
  const packageJson = resolve(root, 'package.json');
  if (!existsSync(packageJson)) throw new Error('Run this script from frontend root. Example: cd /root/ai-financer/frontend');
  const pkg = JSON.parse(readFileSync(packageJson, 'utf8'));
  if (!pkg.scripts?.build || !pkg.scripts?.['audit:predeploy:strict']) {
    throw new Error('frontend package.json must include build and audit:predeploy:strict scripts');
  }
}

console.log('AI-Financer final frontend check');
console.log(`Frontend root: ${root}`);
console.log(`Stop on fail: ${stopOnFail ? 'yes' : 'no'}`);

try {
  assertFrontendContext();
} catch (error) {
  console.error(error);
  process.exit(1);
}

await check('predeploy strict audit', () => run('npm', ['run', 'audit:predeploy:strict']));
await check('frontend build', () => run('npm', ['run', 'build']));

console.log('\n=== summary ===');
for (const item of checks) {
  console.log(`${item.ok ? '✓' : '✕'} ${item.name} (${item.ms}ms)${item.error ? ` — ${item.error}` : ''}`);
}

if (failed) {
  console.error('\nFinal frontend check failed. Fix failed checks before test deploy.');
  process.exit(1);
}

console.log('\nFinal frontend check passed. Frontend is ready for test deploy checks.');

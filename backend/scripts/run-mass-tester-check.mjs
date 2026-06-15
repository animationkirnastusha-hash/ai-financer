#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { loadBackendEnv } from './lib/load-backend-env.mjs';

const backendRoot = process.cwd();
const loadedEnvFiles = loadBackendEnv({ backendRoot });
const projectRoot = path.resolve(backendRoot, '..');
const frontendRoot = path.resolve(projectRoot, 'frontend');
const stopOnFail = process.env.MASS_CHECK_STOP_ON_FAIL !== '0';
const reportDir = path.resolve(backendRoot, 'reports/mass-tester-check');
const jsonReportPath = path.join(reportDir, 'mass-tester-check.json');
const markdownReportPath = path.join(reportDir, 'mass-tester-check.md');
const checks = [];
let failed = false;

function ensureContext() {
  const backendPackage = path.resolve(backendRoot, 'package.json');
  const frontendPackage = path.resolve(frontendRoot, 'package.json');
  if (!fs.existsSync(backendPackage)) throw new Error('Run this script from backend root.');
  if (!fs.existsSync(frontendPackage)) throw new Error(`Frontend package.json was not found at ${frontendPackage}`);

  const backendPkg = JSON.parse(fs.readFileSync(backendPackage, 'utf8'));
  const frontendPkg = JSON.parse(fs.readFileSync(frontendPackage, 'utf8'));
  const backendRequired = ['repo:clean', 'release:check', 'smoke:tester-critical', 'test:product-scenarios'];
  const frontendRequired = ['predeploy:full', 'audit:product-readiness'];
  const backendMissing = backendRequired.filter((script) => !backendPkg.scripts?.[script]);
  const frontendMissing = frontendRequired.filter((script) => !frontendPkg.scripts?.[script]);

  if (backendMissing.length) throw new Error(`backend package.json is missing scripts: ${backendMissing.join(', ')}`);
  if (frontendMissing.length) throw new Error(`frontend package.json is missing scripts: ${frontendMissing.join(', ')}`);
}

function run(command, args, options = {}) {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, {
      cwd: options.cwd || backendRoot,
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
  console.log(`\n=== ${name} ===`);
  const started = Date.now();
  try {
    const code = await fn();
    const durationMs = Date.now() - started;
    if (code === 0) {
      checks.push({ name, ok: true, durationMs });
      console.log(`✓ ${name} passed (${durationMs}ms)`);
      return;
    }
    throw new Error(`${name} exited with code ${code}`);
  } catch (error) {
    const durationMs = Date.now() - started;
    failed = true;
    checks.push({ name, ok: false, durationMs, error: error?.message || String(error) });
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
    projectRoot,
    backendRoot,
    frontendRoot,
    stopOnFail,
    ok: !failed,
    checks,
  };
  fs.writeFileSync(jsonReportPath, `${JSON.stringify(payload, null, 2)}\n`);

  const lines = [
    '# AI-Financer mass tester check',
    '',
    `Generated: ${payload.generatedAt}`,
    `Project root: ${projectRoot}`,
    `Result: ${payload.ok ? 'passed' : 'failed'}`,
    '',
    '| Check | Result | Time |',
    '| --- | --- | ---: |',
    ...checks.map((item) => `| ${item.name} | ${item.ok ? 'passed' : `failed: ${item.error || 'error'}`} | ${item.durationMs}ms |`),
    '',
  ];
  fs.writeFileSync(markdownReportPath, `${lines.join('\n')}\n`);
}

console.log('AI-Financer mass tester check');
console.log(`Project root: ${projectRoot}`);
console.log(`Backend root: ${backendRoot}`);
console.log(`Env files loaded: ${loadedEnvFiles.length ? loadedEnvFiles.join(', ') : 'none'}`);
console.log(`Frontend root: ${frontendRoot}`);
console.log(`Stop on fail: ${stopOnFail ? 'yes' : 'no'}`);

try {
  ensureContext();
} catch (error) {
  console.error(error);
  process.exit(1);
}

await check('initial cleanup', () => run('npm', ['run', 'repo:clean']));
await check('backend release check', () => run('npm', ['run', 'release:check']));
await check('tester critical backend scenarios', () => run('npm', ['run', 'smoke:tester-critical']));
await check('five product scenario scripts', () => run('npm', ['run', 'test:product-scenarios']));
await check('frontend predeploy check', () => run('npm', ['run', 'predeploy:full'], { cwd: frontendRoot }));
await check('frontend product readiness audit', () => run('npm', ['run', 'audit:product-readiness'], { cwd: frontendRoot }));
await check('final cleanup', () => run('node', ['scripts/clean-local-artifacts.mjs', '--keep-dist', '--keep-reports']));

writeReport();

console.log('\n=== summary ===');
for (const item of checks) {
  console.log(`${item.ok ? '✓' : '✕'} ${item.name} (${item.durationMs}ms)${item.error ? ` — ${item.error}` : ''}`);
}
console.log(`\nReport: ${path.relative(backendRoot, markdownReportPath)}`);

if (failed) {
  console.error('\nMass tester check failed. Fix failed checks before external testing.');
  process.exit(1);
}

console.log('\nMass tester check passed. Proceed to manual screen-by-screen testing.');

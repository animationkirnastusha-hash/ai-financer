#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const backendRoot = process.cwd();
const projectRoot = path.resolve(backendRoot, '..');
const frontendRoot = path.resolve(projectRoot, 'frontend');
const stopOnFail = process.env.TESTER_CHECK_STOP_ON_FAIL !== '0';
const reportDir = path.resolve(backendRoot, 'reports/final-tester-check');
const jsonReportPath = path.join(reportDir, 'final-tester-check.json');
const markdownReportPath = path.join(reportDir, 'final-tester-check.md');
const checks = [];
let failed = false;

const volatileArtifacts = [
  'backend/.test-auth-token',
  'backend/.test-auth-token.env',
  'backend/tsconfig.tsbuildinfo',
  'frontend/tsconfig.node.tsbuildinfo',
  'backend/desktop.ini',
  'frontend/desktop.ini',
  '.tmp.drivedownload',
  '.tmp.driveupload',
];

function ensureContext() {
  const backendPackage = path.resolve(backendRoot, 'package.json');
  const frontendPackage = path.resolve(frontendRoot, 'package.json');
  const prismaSchema = path.resolve(backendRoot, 'prisma/schema.prisma');

  if (!fs.existsSync(backendPackage) || !fs.existsSync(prismaSchema)) {
    throw new Error('Run this script from backend root. Example: cd /root/ai-financer/backend');
  }
  if (!fs.existsSync(frontendPackage)) {
    throw new Error(`Frontend package.json was not found at ${frontendPackage}`);
  }

  const backendPkg = JSON.parse(fs.readFileSync(backendPackage, 'utf8'));
  const frontendPkg = JSON.parse(fs.readFileSync(frontendPackage, 'utf8'));
  const backendRequired = ['release:check', 'repo:clean'];
  const frontendRequired = ['predeploy:full'];
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

function assertNoVolatileArtifacts() {
  const found = volatileArtifacts.filter((relativePath) => fs.existsSync(path.resolve(projectRoot, relativePath)));
  if (found.length) {
    console.error('Volatile local artifacts are still present:');
    for (const item of found) console.error(`- ${item}`);
    return 1;
  }
  console.log('No volatile local artifacts found.');
  return 0;
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
    '# AI-Financer final tester check',
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

console.log('AI-Financer final tester check');
console.log(`Project root: ${projectRoot}`);
console.log(`Backend root: ${backendRoot}`);
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
await check('frontend predeploy check', () => run('npm', ['run', 'predeploy:full'], { cwd: frontendRoot }));
await check('final cleanup', () => run('node', ['scripts/clean-local-artifacts.mjs', '--keep-dist', '--keep-reports']));
await check('volatile artifact check', async () => assertNoVolatileArtifacts());

writeReport();

console.log('\n=== summary ===');
for (const item of checks) {
  console.log(`${item.ok ? '✓' : '✕'} ${item.name} (${item.durationMs}ms)${item.error ? ` — ${item.error}` : ''}`);
}
console.log(`\nReport: ${path.relative(backendRoot, markdownReportPath)}`);

if (failed) {
  console.error('\nFinal tester check failed. Fix failed checks before giving the app to testers.');
  process.exit(1);
}

console.log('\nFinal tester check passed. The codebase is ready for manual tester scenarios.');

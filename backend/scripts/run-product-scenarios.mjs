#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { loadBackendEnv } from './lib/load-backend-env.mjs';

const backendRoot = process.cwd();
const loadedEnvFiles = loadBackendEnv({ backendRoot });
const stopOnFail = process.env.PRODUCT_SCENARIOS_STOP_ON_FAIL !== '0';
const reportDir = path.resolve(backendRoot, 'reports/product-scenarios');
const jsonReportPath = path.join(reportDir, 'product-scenarios.json');
const markdownReportPath = path.join(reportDir, 'product-scenarios.md');

const scenarios = [
  ['scenario-01-core-money-flow', 'scripts/product-scenarios/scenario-01-core-money-flow.mjs'],
  ['scenario-02-goal-autosave-flow', 'scripts/product-scenarios/scenario-02-goal-autosave-flow.mjs'],
  ['scenario-03-taxonomy-merchant-meaning', 'scripts/product-scenarios/scenario-03-taxonomy-merchant-meaning.mjs'],
  ['scenario-04-limits-obligations-reports', 'scripts/product-scenarios/scenario-04-limits-obligations-reports.mjs'],
];

const results = [];
let failed = false;

function ensureContext() {
  if (!fs.existsSync(path.resolve(backendRoot, 'package.json'))) {
    throw new Error('Run this script from backend root. Example: cd /root/ai-financer/backend');
  }

  const missing = scenarios
    .map(([, relativePath]) => relativePath)
    .filter((relativePath) => !fs.existsSync(path.resolve(backendRoot, relativePath)));

  if (missing.length) throw new Error(`Missing product scenario scripts: ${missing.join(', ')}`);
}

function runScenario(name, relativePath) {
  return new Promise((resolveRun) => {
    const started = Date.now();
    console.log(`\n=== ${name} ===`);
    const child = spawn('node', [relativePath], {
      cwd: backendRoot,
      env: { ...process.env },
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    child.on('close', (code) => {
      const durationMs = Date.now() - started;
      const ok = code === 0;
      results.push({ name, ok, durationMs, code });
      if (ok) console.log(`✓ ${name} passed (${durationMs}ms)`);
      else console.error(`✕ ${name} failed (${durationMs}ms)`);
      resolveRun(ok);
    });

    child.on('error', (error) => {
      const durationMs = Date.now() - started;
      results.push({ name, ok: false, durationMs, error: error.message });
      console.error(error);
      resolveRun(false);
    });
  });
}

function writeReport() {
  fs.mkdirSync(reportDir, { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    backendRoot,
    envFilesLoaded: loadedEnvFiles,
    stopOnFail,
    ok: !failed,
    scenarios: results,
  };
  fs.writeFileSync(jsonReportPath, `${JSON.stringify(payload, null, 2)}\n`);

  const lines = [
    '# Product scenarios',
    '',
    `Generated: ${payload.generatedAt}`,
    `Result: ${payload.ok ? 'passed' : 'failed'}`,
    `Env files loaded: ${loadedEnvFiles.length ? loadedEnvFiles.join(', ') : 'none'}`,
    '',
    '| Scenario | Result | Time |',
    '| --- | --- | ---: |',
    ...results.map((item) => `| ${item.name} | ${item.ok ? 'passed' : `failed${item.error ? `: ${item.error}` : ''}`} | ${item.durationMs}ms |`),
    '',
  ];
  fs.writeFileSync(markdownReportPath, `${lines.join('\n')}\n`);
}

console.log('AI-Financer product scenarios');
console.log(`Backend root: ${backendRoot}`);
console.log(`Env files loaded: ${loadedEnvFiles.length ? loadedEnvFiles.join(', ') : 'none'}`);
console.log(`Stop on fail: ${stopOnFail ? 'yes' : 'no'}`);

try {
  ensureContext();
} catch (error) {
  console.error(error);
  process.exit(1);
}

for (const [name, relativePath] of scenarios) {
  const ok = await runScenario(name, relativePath);
  if (!ok) {
    failed = true;
    if (stopOnFail) break;
  }
}

writeReport();

console.log('\n=== summary ===');
for (const item of results) {
  console.log(`${item.ok ? '✓' : '✕'} ${item.name} (${item.durationMs}ms)`);
}
console.log(`\nReport: ${path.relative(backendRoot, markdownReportPath)}`);

if (failed) {
  console.error('\nProduct scenarios failed. Fix failed scenario before external testing.');
  process.exit(1);
}

console.log('\nProduct scenarios passed.');

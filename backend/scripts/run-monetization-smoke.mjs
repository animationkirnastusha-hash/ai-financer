import { spawnSync } from 'node:child_process';

const checks = [
  ['store/subscription', 'scripts/smoke/check-store-subscription.mjs'],
  ['business workspace', 'scripts/smoke/check-business-workspace.mjs'],
  ['receipt scans', 'scripts/smoke/check-receipt-scans.mjs'],
  ['ai training', 'scripts/smoke/check-ai-training.mjs'],
];

const started = Date.now();
const failed = [];

console.log('AI-Financer monetization smoke');
console.log(`Base URL: ${process.env.TEST_BASE_URL || process.env.API_BASE_URL || 'http://localhost:3000/api'}`);
console.log('');

for (const [name, script] of checks) {
  console.log(`\n=== ${name} ===`);
  const result = spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });

  if (result.status !== 0) {
    failed.push(name);
    if (process.env.SMOKE_STOP_ON_FAIL !== '0') break;
  }
}

console.log('');
if (failed.length) {
  console.error(`Monetization smoke failed: ${failed.join(', ')}`);
  process.exit(1);
}

console.log(`Monetization smoke passed (${Date.now() - started}ms)`);

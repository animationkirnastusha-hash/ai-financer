import { spawnSync } from 'node:child_process';

const checks = [
  ['health/auth', 'scripts/smoke/check-health-auth.mjs'],
  ['prisma status', 'scripts/smoke/check-prisma-status.mjs'],
  ['accounts/balances', 'scripts/smoke/check-accounts-balances.mjs'],
  ['transactions', 'scripts/smoke/check-transactions.mjs'],
  ['taxonomy crud', 'scripts/smoke/check-taxonomy.mjs'],
  ['taxonomy autocategory', 'scripts/smoke/check-taxonomy-autocategory.mjs'],
  ['goals/limits', 'scripts/smoke/check-goals-limits.mjs'],
  ['obligations/reports', 'scripts/smoke/check-obligations-reports.mjs'],
  ['analytics', 'scripts/smoke/check-analytics.mjs'],
  ['voice/status', 'scripts/smoke/check-voice-status.mjs'],
  ['ai base', 'scripts/smoke/check-ai-base.mjs'],
  ['reset/admin', 'scripts/smoke/check-reset-admin.mjs'],
];

const started = Date.now();
const failed = [];

console.log('AI-Financer predeploy smoke');
console.log(`Base URL: ${process.env.TEST_BASE_URL || process.env.API_BASE_URL || 'http://localhost:3000/api'}`);
console.log(`Stop on fail: ${process.env.SMOKE_STOP_ON_FAIL === '0' ? 'no' : 'yes'}`);
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
  console.error(`Predeploy smoke failed: ${failed.join(', ')}`);
  process.exit(1);
}

console.log(`Predeploy smoke passed (${Date.now() - started}ms)`);

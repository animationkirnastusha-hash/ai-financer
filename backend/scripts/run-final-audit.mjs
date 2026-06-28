#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const backendRoot = process.cwd();
const projectRoot = path.resolve(backendRoot, '..');
const checks = [];
const warnings = [];

function resolve(relativePath) {
  return path.resolve(projectRoot, relativePath);
}

function exists(relativePath) {
  return fs.existsSync(resolve(relativePath));
}

function read(relativePath) {
  return fs.readFileSync(resolve(relativePath), 'utf8');
}

function addProblem(message) {
  checks.push({ ok: false, message });
}

function addOk(message) {
  checks.push({ ok: true, message });
}

function addWarning(message) {
  warnings.push(message);
}

const forbiddenRepoArtifacts = [
  '.tmp.drivedownload',
  '.tmp.driveupload',
  'backend/.env',
  'frontend/.env',
  'backend/prisma/dev.db',
  'backend/prisma/dev.db-journal',
  'backend/prisma/dev.db-wal',
  'backend/prisma/dev.db-shm',
  'backend/desktop.ini',
  'frontend/desktop.ini',
  'frontend/tsconfig.node.tsbuildinfo',
  'backend/tsconfig.tsbuildinfo',
  'backend/.test-auth-token',
  'backend/.test-auth-token.env',
];

const obsoleteScripts = [
  'backend/scripts/apply-ai-settings-prisma-routes-fix.mjs',
  'backend/scripts/apply-ai-settings-tools-core.mjs',
  'backend/scripts/apply-final-hardening-schema.mjs',
  'backend/scripts/apply-mega-foundation-schema.mjs',
  'backend/scripts/run-ai-tests.mjs',
  'backend/scripts/run-product-tests.mjs',
  'backend/scripts/run-backend-integrity-suite.mjs',
  'backend/scripts/run-http-confirm-smoke.mjs',
  'backend/scripts/run-basic-ai-regression.mjs',
  'backend/scripts/run-final-test-deploy-check.mjs',
  'backend/scripts/run-final-tester-check.mjs',
  'backend/scripts/check-taxonomy.mjs',
  'backend/scripts/check-receipt-scans.mjs',
  'backend/scripts/smoke/check-business-workspace.mjs',
  'frontend/scripts/audit-hardcoded-russian.mjs',
  'frontend/scripts/audit-i18n.mjs',
];

const confirmedOrphanFiles = [
  'frontend/src/app/App.tsx',
  'frontend/src/pages/settings/TaxonomySettingsPage.tsx',
  'frontend/src/pages/settings/TaxonomySettingsPage.css',
  'frontend/src/shared/lib/queryProvider.tsx',
  'frontend/src/features/payments/ui/PaymentStatusBanner.tsx',
  'frontend/src/features/business-workspace',
  'frontend/src/pages/business-accountant',
  'backend/src/modules/business-workspace',
];

for (const item of forbiddenRepoArtifacts) {
  if (exists(item)) addProblem(`remove local/repo artifact: ${item}`);
}

for (const item of obsoleteScripts) {
  if (exists(item)) addWarning(`obsolete script can be removed: ${item}`);
}

for (const item of confirmedOrphanFiles) {
  if (exists(item)) addProblem(`remove confirmed orphan file: ${item}`);
}

const requiredBackendFiles = [
  'backend/scripts/lib/load-backend-env.mjs',
  'backend/scripts/clean-local-artifacts.mjs',
  'backend/scripts/create-test-token.mjs',
  'backend/scripts/check-ai-money-contract.ts',
  'backend/scripts/run-prisma-migrate-deploy.mjs',
  'backend/scripts/run-prisma-migrate-status.mjs',
  'backend/scripts/run-backend-release-check.mjs',
  'backend/scripts/run-predeploy-smoke.mjs',
  'backend/scripts/run-monetization-smoke.mjs',
  'backend/scripts/run-product-scenarios.mjs',
  'backend/scripts/run-mass-tester-check.mjs',
  'backend/scripts/smoke/lib/http-client.mjs',
  'backend/scripts/smoke/lib/test-context.mjs',
  'backend/scripts/smoke/check-health-auth.mjs',
  'backend/scripts/smoke/check-prisma-status.mjs',
  'backend/scripts/smoke/check-accounts-balances.mjs',
  'backend/scripts/smoke/check-transactions.mjs',
  'backend/scripts/smoke/check-taxonomy-contract.mjs',
  'backend/scripts/smoke/check-goals-limits.mjs',
  'backend/scripts/smoke/check-obligations-reports.mjs',
  'backend/scripts/smoke/check-analytics.mjs',
  'backend/scripts/smoke/check-ai-base.mjs',
  'backend/scripts/smoke/check-reset-admin.mjs',
  'backend/scripts/smoke/check-store-subscription.mjs',
  'backend/scripts/smoke/check-receipt-scans.mjs',
  'backend/scripts/smoke/check-receipt-taxonomy-preview.mjs',
  'backend/scripts/smoke/check-ai-training.mjs',
  'backend/scripts/smoke/check-tester-critical-paths.mjs',
  'backend/scripts/product-scenarios/lib/scenario-helpers.mjs',
  'backend/scripts/product-scenarios/scenario-01-core-money-flow.mjs',
  'backend/scripts/product-scenarios/scenario-02-goal-autosave-flow.mjs',
  'backend/scripts/product-scenarios/scenario-03-taxonomy-merchant-meaning.mjs',
  'backend/scripts/product-scenarios/scenario-04-limits-obligations-reports.mjs',
];

for (const file of requiredBackendFiles) {
  if (exists(file)) addOk(`required backend script exists: ${file}`);
  else addProblem(`missing required backend script: ${file}`);
}

const tokenScriptPath = 'backend/scripts/create-test-token.mjs';
if (exists(tokenScriptPath)) {
  const source = read(tokenScriptPath);
  const hasModernToken = source.includes('sub: user.id')
    && source.includes('randomUUID')
    && source.includes('issuer')
    && source.includes('audience')
    && source.includes('JWT_SECRET is required');
  if (hasModernToken) addOk('create-test-token.mjs uses modern JWT claims');
  else addProblem('create-test-token.mjs still creates legacy JWT tokens');
}


const prismaSchemaPath = 'backend/prisma/schema.prisma';
if (exists(prismaSchemaPath)) {
  const schema = read(prismaSchemaPath);
  for (const forbidden of ['BusinessWorkspace', 'businessWorkspace', 'businessUntil', 'businessLifetime']) {
    if (schema.includes(forbidden)) addProblem(`remove Business schema leftover: ${forbidden}`);
  }
}

const backendPackagePath = 'backend/package.json';
if (!exists(backendPackagePath)) {
  addProblem('backend/package.json is missing');
} else {
  const pkg = JSON.parse(read(backendPackagePath));
  const scripts = pkg.scripts || {};
  for (const scriptName of [
    'build',
    'db:deploy',
    'db:status',
    'test:token',
    'test:ai-money-contract',
    'smoke:predeploy',
    'smoke:monetization',
    'smoke:full',
    'smoke:tester-critical',
    'test:product-scenarios',
    'test:mass',
    'audit:final',
    'repo:clean',
    'release:check',
    'predeploy:full',
  ]) {
    if (scripts[scriptName]) addOk(`backend script exists: ${scriptName}`);
    else addProblem(`missing backend npm script: ${scriptName}`);
  }
}

const frontendPackagePath = 'frontend/package.json';
if (!exists(frontendPackagePath)) {
  addProblem('frontend/package.json is missing');
} else {
  const pkg = JSON.parse(read(frontendPackagePath));
  const scripts = pkg.scripts || {};
  for (const scriptName of ['build', 'audit:css', 'audit:predeploy:strict', 'audit:product-readiness', 'predeploy:full']) {
    if (scripts[scriptName]) addOk(`frontend script exists: ${scriptName}`);
    else addProblem(`missing frontend npm script: ${scriptName}`);
  }
}

const backendReleaseRunnerPath = 'backend/scripts/run-backend-release-check.mjs';
if (exists(backendReleaseRunnerPath)) {
  const source = read(backendReleaseRunnerPath);
  const hasBuild = source.includes('backend build');
  const hasMoneyContract = source.includes('AI money contract tests');
  const hasAudit = source.includes('final backend audit');
  const hasPrisma = source.includes('prisma migrate status');
  const hasPredeploySmoke = source.includes('predeploy smoke');
  const hasMonetizationSmoke = source.includes('monetization smoke');
  const hasReport = source.includes('backend-release-check') && source.includes('release-check.md');
  if (hasBuild && hasMoneyContract && hasAudit && hasPrisma && hasPredeploySmoke && hasMonetizationSmoke && hasReport) {
    addOk('backend release runner covers build, contracts, audit, Prisma, smoke and report');
  } else {
    addProblem('backend release runner must cover build, contracts, audit, Prisma, smoke and report');
  }
}

const backendMassRunnerPath = 'backend/scripts/run-mass-tester-check.mjs';
if (exists(backendMassRunnerPath)) {
  const source = read(backendMassRunnerPath);
  const hasRelease = source.includes('backend release check');
  const hasCritical = source.includes('tester critical backend scenarios');
  const hasScenarios = source.includes('five product scenario scripts');
  const hasFrontend = source.includes('frontend predeploy check');
  const hasProductReadiness = source.includes('frontend product readiness audit');
  if (hasRelease && hasCritical && hasScenarios && hasFrontend && hasProductReadiness) {
    addOk('mass tester runner covers release, critical scenarios, product scenarios and frontend checks');
  } else {
    addProblem('mass tester runner is missing required gates');
  }
}

const frontendFinalRunnerPath = 'frontend/scripts/run-final-frontend-check.mjs';
if (exists(frontendFinalRunnerPath)) {
  const source = read(frontendFinalRunnerPath);
  const hasCssAudit = source.includes('CSS audit report');
  const hasPredeployAudit = source.includes('predeploy strict audit');
  const hasBuild = source.includes('frontend build');
  if (hasCssAudit && hasPredeployAudit && hasBuild) addOk('frontend predeploy runner covers CSS audit, strict audit and build');
  else addProblem('frontend predeploy runner must cover CSS audit, strict audit and build');
}

const rootGitignore = exists('.gitignore') ? read('.gitignore') : '';
for (const pattern of [
  '.env',
  '.env.*',
  '!.env.example',
  '*.db',
  '*.sqlite',
  '*.sqlite3',
  'desktop.ini',
  '*.tsbuildinfo',
  '.tmp.drivedownload/',
  '.tmp.driveupload/',
  'backend/reports',
  'frontend/reports',
]) {
  if (rootGitignore.includes(pattern)) addOk(`root .gitignore contains ${pattern}`);
  else addWarning(`root .gitignore should contain ${pattern}`);
}

const problems = checks.filter((item) => !item.ok);
const passed = checks.filter((item) => item.ok);

console.log('AI-Financer repository safety audit');
console.log(`Project root: ${projectRoot}`);
console.log('');

for (const item of passed) console.log(`✓ ${item.message}`);
for (const item of warnings) console.log(`! ${item}`);
for (const item of problems) console.log(`✕ ${item.message}`);

console.log('');
console.log(`Passed: ${passed.length}`);
console.log(`Warnings: ${warnings.length}`);
console.log(`Problems: ${problems.length}`);

if (problems.length > 0) {
  console.log('');
  console.log('Repository safety audit failed. Run npm run repo:clean and remove listed required blockers. Obsolete script warnings are cleanup-only.');
  process.exit(1);
}

console.log('Repository safety audit passed. Run npm run release:check or npm run test:mass.');

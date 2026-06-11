#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const projectRoot = path.resolve(root, '..');

const checks = [];
const warnings = [];

function exists(relativePath) {
  return fs.existsSync(path.resolve(projectRoot, relativePath));
}

function read(relativePath) {
  return fs.readFileSync(path.resolve(projectRoot, relativePath), 'utf8');
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
  'backend/.test-auth-token',
  'backend/.test-auth-token.env',
  'backend/scripts/create-test-token copy.mjs',
  'backend/scripts/create-test-token copy 2.mjs',
];

const obsoleteOneShotScripts = [
  'backend/scripts/apply-ai-settings-prisma-routes-fix.mjs',
  'backend/scripts/apply-ai-settings-tools-core.mjs',
  'backend/scripts/apply-final-hardening-schema.mjs',
  'backend/scripts/apply-mega-foundation-schema.mjs',
];


const confirmedOrphanFiles = [
  'frontend/src/app/App.tsx',
  'frontend/src/pages/settings/TaxonomySettingsPage.tsx',
  'frontend/src/pages/settings/TaxonomySettingsPage.css',
  'frontend/src/shared/lib/queryProvider.tsx',
  'frontend/src/features/payments/ui/PaymentStatusBanner.tsx',
];

for (const item of forbiddenRepoArtifacts) {
  if (exists(item)) addProblem(`remove local/repo artifact: ${item}`);
}
for (const item of obsoleteOneShotScripts) {
  if (exists(item)) addProblem(`remove obsolete one-shot script: ${item}`);
}
for (const item of confirmedOrphanFiles) {
  if (exists(item)) addProblem(`remove confirmed orphan file: ${item}`);
}

const tokenScriptPath = 'backend/scripts/create-test-token.mjs';
if (!exists(tokenScriptPath)) {
  addProblem(`${tokenScriptPath} is missing`);
} else {
  const source = read(tokenScriptPath);
  const hasModernToken = source.includes('sub: user.id')
    && source.includes('randomUUID')
    && source.includes('issuer')
    && source.includes('audience')
    && source.includes('JWT_SECRET is required');
  if (hasModernToken) addOk('create-test-token.mjs uses modern JWT claims');
  else addProblem('create-test-token.mjs still creates legacy JWT tokens');
}

const backendPackagePath = 'backend/package.json';
if (!exists(backendPackagePath)) {
  addProblem('backend/package.json is missing');
} else {
  const pkg = JSON.parse(read(backendPackagePath));
  const scripts = pkg.scripts || {};
  for (const scriptName of [
    'db:deploy',
    'db:status',
    'smoke:predeploy',
    'smoke:health',
    'smoke:prisma',
    'smoke:ai',
    'smoke:accounts',
    'smoke:transactions',
    'smoke:taxonomy',
    'smoke:analytics',
    'smoke:reset-admin',
    'audit:final',
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
  if (scripts.build) addOk('frontend build script exists');
  else addProblem('missing frontend build script');
  if (scripts['audit:css']) addOk('frontend audit:css script exists');
  else addWarning('frontend audit:css script is missing');
}


const backendFinalRunnerPath = 'backend/scripts/run-final-test-deploy-check.mjs';
if (!exists(backendFinalRunnerPath)) {
  addProblem(`${backendFinalRunnerPath} is missing`);
} else {
  const source = read(backendFinalRunnerPath);
  const hasBuild = source.includes("npm', ['run', 'build']") || source.includes('backend build');
  const hasAudit = source.includes("npm', ['run', 'audit:final']") || source.includes('final backend audit');
  const hasSmoke = source.includes("npm', ['run', 'smoke:full']") || source.includes('full backend smoke');
  if (hasBuild && hasAudit && hasSmoke) addOk('backend predeploy runner executes build, audit and smoke');
  else addProblem('backend predeploy runner must execute build, audit and smoke checks');
}

const frontendFinalRunnerPath = 'frontend/scripts/run-final-frontend-check.mjs';
if (!exists(frontendFinalRunnerPath)) {
  addProblem(`${frontendFinalRunnerPath} is missing`);
} else {
  const source = read(frontendFinalRunnerPath);
  const hasCssAudit = source.includes("npm', ['run', 'audit:css']") || source.includes('CSS audit report');
  const hasPredeployAudit = source.includes("npm', ['run', 'audit:predeploy:strict']") || source.includes('predeploy strict audit');
  const hasBuild = source.includes("npm', ['run', 'build']") || source.includes('frontend build');
  if (hasCssAudit && hasPredeployAudit && hasBuild) addOk('frontend predeploy runner executes CSS audit, strict audit and build');
  else addProblem('frontend predeploy runner must execute CSS audit, strict audit and build');
}

const rootGitignore = exists('.gitignore') ? read('.gitignore') : '';
for (const pattern of ['.env', '.env.*', '!.env.example', '*.db', '*.sqlite', '*.sqlite3', 'desktop.ini', '*.tsbuildinfo']) {
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
  console.log('Repository safety audit failed. Remove listed artifacts/orphans or apply missing files, then run npm run audit:final again.');
  process.exit(1);
}

console.log('Repository safety audit passed. Run npm run predeploy:full for build, Prisma and smoke checks.');

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const backendRoot = process.cwd();
const projectRoot = path.resolve(backendRoot, '..');
const dryRun = process.argv.includes('--dry-run');
const keepDist = process.argv.includes('--keep-dist') || process.env.REPO_CLEAN_KEEP_DIST === '1';
const keepReports = process.argv.includes('--keep-reports') || process.env.REPO_CLEAN_KEEP_REPORTS === '1';

const targets = [
  '.tmp.drivedownload',
  '.tmp.driveupload',
  'frontend/tsconfig.node.tsbuildinfo',
  'backend/tsconfig.tsbuildinfo',
  'backend/.test-auth-token',
  'backend/.test-auth-token.env',
  'backend/desktop.ini',
  'frontend/desktop.ini',
  'backend/prisma/dev.db',
  'backend/prisma/dev.db-journal',
  'backend/prisma/dev.db-wal',
  'backend/prisma/dev.db-shm',
];

if (!keepDist) targets.push('frontend/dist');
if (!keepReports) {
  targets.push('backend/reports');
  targets.push('frontend/reports');
}

const removed = [];
const skipped = [];

for (const relativePath of targets) {
  const absolutePath = path.resolve(projectRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    skipped.push(relativePath);
    continue;
  }

  removed.push(relativePath);
  if (!dryRun) {
    fs.rmSync(absolutePath, { recursive: true, force: true });
  }
}

console.log('AI-Financer local artifact cleanup');
console.log(`Project root: ${projectRoot}`);
console.log(`Mode: ${dryRun ? 'dry-run' : 'delete'}`);
console.log(`Keep frontend dist: ${keepDist ? 'yes' : 'no'}`);
console.log(`Keep reports: ${keepReports ? 'yes' : 'no'}`);
console.log('');

if (removed.length) {
  console.log(`${dryRun ? 'Would remove' : 'Removed'}:`);
  for (const item of removed) console.log(`- ${item}`);
} else {
  console.log('Nothing to remove.');
}

if (skipped.length) {
  console.log('');
  console.log(`Skipped missing: ${skipped.length}`);
}

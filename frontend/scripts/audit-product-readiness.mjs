#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const frontendRoot = process.cwd();
const srcRoot = path.resolve(frontendRoot, 'src');
const reportDir = path.resolve(frontendRoot, 'reports/product-readiness');
const reportPath = path.join(reportDir, 'product-readiness.md');
const findings = [];

function addFinding(type, file, message, line = 0) {
  findings.push({ type, file: path.relative(frontendRoot, file), line, message });
}

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', 'reports'].includes(entry.name)) walk(full, files);
    } else if (/\.(ts|tsx|css)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function assertFile(relativePath) {
  const full = path.resolve(frontendRoot, relativePath);
  if (!fs.existsSync(full)) addFinding('missing-file', full, `${relativePath} is missing`);
}

function checkNoLegacyOnboardingSteps(files) {
  const patterns = ['features/onboarding/ui/steps', "./steps", "../steps"];
  for (const file of files) {
    const content = read(file);
    patterns.forEach((pattern) => {
      if (content.includes(pattern)) addFinding('legacy-onboarding', file, `legacy onboarding step import: ${pattern}`);
    });
  }
}

function checkNoFixedAmountsInLearningExamples(files) {
  const targetFiles = files.filter((file) => /locales[\\/](ru|en)[\\/](onboarding|profile|text-chat|settings|misc)\.ts$/.test(file));
  const commandWords = /(Потратил|Получил|доход|расход|лимит|цель|Spent|Got|received|income|expense|limit|goal)/i;
  const amountLike = /(?:\d[\d\s]{1,}|\d+[.,]\d+)/;

  for (const file of targetFiles) {
    const lines = read(file).split(/\r?\n/);
    lines.forEach((line, index) => {
      const isLikelyExample = /(example|examples|learning|prompt|command|подсказ|пример)/i.test(line);
      if (isLikelyExample && commandWords.test(line) && amountLike.test(line)) {
        addFinding('fixed-amount-example', file, 'learning/example command should not contain a fixed amount', index + 1);
      }
    });
  }
}

function checkNoHighConfidenceTechnicalCopy(files) {
  const banned = [
    'AI Core',
    'System status',
    'system status',
    'implementation',
    'roadmap',
    'debug panel',
    'Endpoint',
    'Endpoints',
  ];
  const ignored = [
    'features/admin',
    'pages/admin',
    'scripts/',
  ];

  for (const file of files) {
    const relative = path.relative(frontendRoot, file).replace(/\\/g, '/');
    if (ignored.some((item) => relative.includes(item))) continue;
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const lines = read(file).split(/\r?\n/);
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (
        trimmed.startsWith('import ') ||
        trimmed.startsWith('export ') ||
        trimmed.startsWith('type ') ||
        trimmed.startsWith('interface ') ||
        trimmed.startsWith('//') ||
        trimmed.startsWith('*')
      ) return;

      banned.forEach((term) => {
        if (line.includes(term)) addFinding('technical-copy', file, `high-confidence technical UI copy: ${term}`, index + 1);
      });
    });
  }
}

function checkAnimationAndTourWiring() {
  assertFile('src/features/chat/ui/message/AssistantTypingText.tsx');
  assertFile('src/features/onboarding/ui/ProductTourOverlay.tsx');
  assertFile('src/app/styles/features/onboarding/product-tour.css');
  assertFile('src/app/styles/animations/chat-motion.css');

  const dashboard = read(path.resolve(srcRoot, 'pages/dashboard/DashboardPage.tsx'));
  if (dashboard && !dashboard.includes('ProductTourOverlay')) {
    addFinding('tour-wiring', path.resolve(srcRoot, 'pages/dashboard/DashboardPage.tsx'), 'ProductTourOverlay is not mounted on dashboard');
  }

  const indexCss = read(path.resolve(srcRoot, 'app/styles/index.css'));
  if (indexCss && !indexCss.includes('product-tour.css')) {
    addFinding('style-wiring', path.resolve(srcRoot, 'app/styles/index.css'), 'product-tour.css is not imported');
  }
  if (indexCss && !indexCss.includes('chat-motion.css')) {
    addFinding('style-wiring', path.resolve(srcRoot, 'app/styles/index.css'), 'chat-motion.css is not imported');
  }
}

function writeReport() {
  fs.mkdirSync(reportDir, { recursive: true });
  const lines = [
    '# Product readiness audit',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Result: ${findings.length ? 'failed' : 'passed'}`,
    '',
  ];

  if (!findings.length) {
    lines.push('No product-readiness issues found.', '');
  } else {
    lines.push('| Type | File | Line | Message |', '| --- | --- | ---: | --- |');
    for (const finding of findings) {
      lines.push(`| ${finding.type} | ${finding.file} | ${finding.line || ''} | ${finding.message.replace(/\|/g, '\\|')} |`);
    }
    lines.push('');
  }

  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`);
}

if (!fs.existsSync(srcRoot)) {
  console.error('Run this script from frontend root. Example: cd frontend && npm run audit:product-readiness');
  process.exit(1);
}

const files = walk(srcRoot);
checkAnimationAndTourWiring();
checkNoLegacyOnboardingSteps(files);
checkNoFixedAmountsInLearningExamples(files);
checkNoHighConfidenceTechnicalCopy(files);
writeReport();

console.log('Product readiness audit complete.');
console.log(`Report: ${path.relative(frontendRoot, reportPath)}`);
if (findings.length) {
  console.error(`Product readiness findings: ${findings.length}`);
  process.exit(1);
}
console.log('Product readiness passed.');

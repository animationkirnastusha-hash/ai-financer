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

function assertContains(relativePath, pattern, message) {
  const full = path.resolve(frontendRoot, relativePath);
  const content = read(full);
  if (!content.includes(pattern)) addFinding('missing-wiring', full, message);
}

function extractStringLiterals(line) {
  const result = [];
  const regex = /(['"`])((?:\\.|(?!\1).)*?)\1/g;
  let match;
  while ((match = regex.exec(line))) result.push(match[2]);
  return result;
}

function checkNoLegacyOnboardingSteps(files) {
  const importPattern = /from\s+['"](?:\.\.\/|\.\/)steps(?:\/[^'"]*)?['"]/;
  for (const file of files) {
    if (!/\.tsx?$/.test(file)) continue;
    const lines = read(file).split(/\r?\n/);
    lines.forEach((line, index) => {
      if (importPattern.test(line)) addFinding('legacy-onboarding', file, 'legacy onboarding step import', index + 1);
    });
  }
}

function checkNoFixedAmountsInLearningExamples(files) {
  const targetFiles = files.filter((file) => /locales[\/](ru|en)[\/](onboarding|profile|text-chat|settings|misc)\.ts$/.test(file));
  const commandWords = /(Потратил|Получил|доход|расход|лимит|цель|Spent|Got|received|income|expense|limit|goal)/i;
  const amountLike = /(?:\d[\d\s]{1,}|\d+[.,]\d+)/;

  for (const file of targetFiles) {
    const lines = read(file).split(/\r?\n/);
    lines.forEach((line, index) => {
      const isLikelyExample = /(example|examples|learning|prompt|command|подсказ|пример|tour)/i.test(line);
      if (isLikelyExample && commandWords.test(line) && amountLike.test(line)) {
        addFinding('fixed-amount-example', file, 'learning/example command should not contain a fixed amount', index + 1);
      }
    });
  }
}

function checkNoWakeWordExamples(files) {
  const targetFiles = files.filter((file) => /locales[\/](ru|en)[\/](onboarding|profile|text-chat|settings|misc)\.ts$/.test(file));
  for (const file of targetFiles) {
    const lines = read(file).split(/\r?\n/);
    lines.forEach((line, index) => {
      if (/['"`]\s*Фина[,.!?:]/.test(line)) {
        addFinding('wake-word-example', file, 'example command should not require wake word Фина', index + 1);
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
    'pending action',
  ];
  const ignored = ['features/admin', 'pages/admin', 'scripts/', 'features/audit-log'];

  for (const file of files) {
    const relative = path.relative(frontendRoot, file).replace(/\\/g, '/');
    if (ignored.some((item) => relative.includes(item))) continue;
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const lines = read(file).split(/\r?\n/);
    lines.forEach((line, index) => {
      if (/console\.(log|warn|error|info|debug)\s*\(/.test(line)) return;
      const literals = extractStringLiterals(line);
      for (const literal of literals) {
        for (const term of banned) {
          if (literal.includes(term)) addFinding('technical-copy', file, `high-confidence technical UI copy: ${term}`, index + 1);
        }
      }
    });
  }
}

function checkProductTourAndLearningWiring() {
  assertFile('src/features/chat/ui/message/AssistantTypingText.tsx');
  assertFile('src/features/onboarding/ui/ProductTourOverlay.tsx');
  assertFile('src/features/onboarding/ui/ProductLearningCard.tsx');
  assertFile('src/app/styles/features/onboarding/product-tour.css');
  assertFile('src/app/styles/features/onboarding/product-learning.css');
  assertFile('src/app/styles/animations/chat-motion.css');

  const appRouter = read(path.resolve(srcRoot, 'app/router/AppRouter.tsx'));
  const dashboard = read(path.resolve(srcRoot, 'pages/dashboard/DashboardPage.tsx'));
  if (!appRouter.includes('ProductTourOverlay') && !dashboard.includes('ProductTourOverlay')) {
    addFinding('tour-wiring', path.resolve(srcRoot, 'app/router/AppRouter.tsx'), 'ProductTourOverlay is not mounted');
  }

  for (const target of ['home-balance', 'home-fina', 'home-learning', 'home-actions', 'home-chart', 'home-insight']) {
    if (!dashboard.includes(`data-product-tour="${target}"`)) {
      addFinding('tour-target', path.resolve(srcRoot, 'pages/dashboard/DashboardPage.tsx'), `Product tour target is missing: ${target}`);
    }
  }

  const indexCss = read(path.resolve(srcRoot, 'app/styles/index.css'));
  for (const css of ['product-tour.css', 'product-learning.css', 'chat-motion.css', 'voice-permission-compact.css']) {
    if (!indexCss.includes(css)) addFinding('style-wiring', path.resolve(srcRoot, 'app/styles/index.css'), `${css} is not imported`);
  }
}

function checkNavigationIA() {
  const bottomNav = read(path.resolve(srcRoot, 'features/navigation/ui/AppBottomNavigation.tsx'));
  const navSheet = read(path.resolve(srcRoot, 'features/navigation/ui/AppNavigationSheet.tsx'));

  for (const screen of ['dashboard', 'goals', 'spending-limits', 'journal', 'profile']) {
    if (!bottomNav.includes(`screen: '${screen}'`)) addFinding('bottom-nav', path.resolve(srcRoot, 'features/navigation/ui/AppBottomNavigation.tsx'), `bottom nav missing ${screen}`);
    if (navSheet.includes(`screen: '${screen}'`)) addFinding('navigation-duplication', path.resolve(srcRoot, 'features/navigation/ui/AppNavigationSheet.tsx'), `menu duplicates first-level screen ${screen}`);
  }

  if (!navSheet.includes(`screen: 'store'`)) addFinding('store-entry', path.resolve(srcRoot, 'features/navigation/ui/AppNavigationSheet.tsx'), 'Store must stay available from menu for base users');
  if (!navSheet.includes(`screen: 'sections'`)) addFinding('taxonomy-entry', path.resolve(srcRoot, 'features/navigation/ui/AppNavigationSheet.tsx'), 'Categories/sections must stay in secondary menu');
}

function checkProductSurfaceFiles() {
  for (const relativePath of [
    'src/features/receipt-scans/ui/ReceiptQuickAction.tsx',
    'src/pages/analytics/AnalyticsPage.tsx',
    'src/pages/premium/PremiumPage.tsx',
    'src/pages/referral/ReferralPage.tsx',
    'src/pages/spending-limits/SpendingLimitsPage.tsx',
    'src/pages/goals/GoalsPage.tsx',
    'src/features/chat/ui/TextChatOverlay.tsx',
    'src/features/voice/ui/VoicePermissionIntro.tsx',
    'src/features/modals/ui/AppModalManager.tsx',
  ]) {
    assertFile(relativePath);
  }
}

function checkLearningKeys() {
  const ru = read(path.resolve(srcRoot, 'shared/lib/i18n/locales/ru/onboarding.ts'));
  const en = read(path.resolve(srcRoot, 'shared/lib/i18n/locales/en/onboarding.ts'));
  for (const key of [
    'learning.eyebrow',
    'learning.task.expense.title',
    'learning.task.question.title',
    'learning.task.goal.title',
    'learning.task.limit.title',
    'learning.done.action',
  ]) {
    if (!ru.includes(`'${key}'`)) addFinding('i18n-key', path.resolve(srcRoot, 'shared/lib/i18n/locales/ru/onboarding.ts'), `missing RU key: ${key}`);
    if (!en.includes(`'${key}'`)) addFinding('i18n-key', path.resolve(srcRoot, 'shared/lib/i18n/locales/en/onboarding.ts'), `missing EN key: ${key}`);
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
checkProductSurfaceFiles();
checkProductTourAndLearningWiring();
checkNavigationIA();
checkLearningKeys();
checkNoLegacyOnboardingSteps(files);
checkNoFixedAmountsInLearningExamples(files);
checkNoWakeWordExamples(files);
checkNoHighConfidenceTechnicalCopy(files);
writeReport();

console.log('Product readiness audit complete.');
console.log(`Report: ${path.relative(frontendRoot, reportPath)}`);
if (findings.length) {
  console.error(`Product readiness findings: ${findings.length}`);
  process.exit(1);
}
console.log('Product readiness passed.');

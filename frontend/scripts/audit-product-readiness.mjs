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

function exists(relativePath) {
  return fs.existsSync(path.resolve(frontendRoot, relativePath));
}

function assertFile(relativePath) {
  const full = path.resolve(frontendRoot, relativePath);
  if (!fs.existsSync(full)) addFinding('missing-file', full, `${relativePath} is missing`);
}

function assertAbsent(relativePath) {
  const full = path.resolve(frontendRoot, relativePath);
  if (fs.existsSync(full)) addFinding('obsolete-surface', full, `${relativePath} must be removed from base frontend`);
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
      const isLikelyExample = /(example|examples|learning|prompt|command|подсказ|пример)/i.test(line);
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

function checkBaseOnboardingAndChatWiring() {
  for (const file of [
    'src/features/chat/ui/TextChatOverlay.tsx',
    'src/features/chat/ui/message/AssistantTypingText.tsx',
    'src/features/chat/model/firstRunChatSetup.store.ts',
    'src/features/onboarding/ui/LaunchOnboardingSheet.tsx',
    'src/features/onboarding/model/onboarding.store.ts',
    'src/features/onboarding/ui/ProductLearningCard.tsx',
    'src/app/styles/pages/onboarding-setup/onboarding-setup-launch.css',
    'src/app/styles/features/onboarding/product-learning.css',
    'src/app/styles/animations/chat-motion.css',
    'src/app/styles/features/voice/voice-permission-compact.css',
  ]) assertFile(file);

  const textChat = read(path.resolve(srcRoot, 'features/chat/ui/TextChatOverlay.tsx'));
  if (/productTour|ProductTour|markProductTour|ai-financer:product-tour/.test(textChat)) {
    addFinding('obsolete-tour', path.resolve(srcRoot, 'features/chat/ui/TextChatOverlay.tsx'), 'first-run chat must not start the removed product tour');
  }

  const indexCss = read(path.resolve(srcRoot, 'app/styles/index.css'));
  for (const css of ['onboarding-setup-launch.css', 'product-learning.css', 'chat-motion.css', 'voice-permission-compact.css']) {
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

  for (const removedScreen of ['store', 'premium', 'business', 'receipts']) {
    if (navSheet.includes(`screen: '${removedScreen}'`)) addFinding('obsolete-navigation', path.resolve(srcRoot, 'features/navigation/ui/AppNavigationSheet.tsx'), `${removedScreen} must not be available in base navigation`);
  }
}

function checkRemovedProductSurfaces(files) {
  for (const relativePath of [
    'src/features/business-workspace',
    'src/features/premium',
    'src/features/receipt-scans',
    'src/features/store',
    'src/features/product-tour',
    'src/pages/business-accountant',
    'src/pages/premium',
    'src/pages/receipt-scans',
  ]) assertAbsent(relativePath);

  const forbiddenPatterns = [
    ['product-tour', /product-tour|ProductTour|productTour|ai-financer:product-tour/i],
    ['premium-ui', /features\/premium|pages\/premium|PremiumUpgrade|PremiumFeatureGate/i],
    ['store-ui', /features\/store|screen:\s*['"]store['"]|StorePage/i],
    ['business-ui', /business-workspace|BusinessAccountant|screen:\s*['"]business/i],
    ['receipt-ui', /features\/receipt-scans|ReceiptQuickAction|screen:\s*['"]receipts/i],
  ];

  for (const file of files) {
    const relative = path.relative(frontendRoot, file).replace(/\\/g, '/');
    if (relative.includes('scripts/audit-product-readiness.mjs')) continue;
    const content = read(file);
    for (const [type, pattern] of forbiddenPatterns) {
      if (pattern.test(content)) addFinding(type, file, 'removed product surface is still referenced');
    }
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
checkBaseOnboardingAndChatWiring();
checkNavigationIA();
checkRemovedProductSurfaces(files);
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

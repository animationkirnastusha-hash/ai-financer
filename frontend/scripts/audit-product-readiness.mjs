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

function assertMissing(relativePath) {
  const full = path.resolve(frontendRoot, relativePath);
  if (fs.existsSync(full)) addFinding('removed-surface-leftover', full, `${relativePath} must be removed from base frontend`);
}

function extractStringLiterals(line) {
  const result = [];
  const regex = /(['"`])((?:\\.|(?!\1).)*?)\1/g;
  let match;
  while ((match = regex.exec(line))) result.push(match[2]);
  return result;
}

function checkRemovedProductSurfaces(files) {
  const removedPaths = [
    'src/features/business-workspace',
    'src/features/payments',
    'src/features/premium',
    'src/features/receipt-scans',
    'src/features/store',
    'src/features/subscription',
    'src/pages/business-accountant',
    'src/pages/premium',
    'src/pages/receipt-scans',
    'src/shared/api/premium.api.ts',
    'src/features/modals/ui/ReceiptPremiumLockSheet.tsx',
    'src/shared/lib/i18n/runtime-dictionary/settings-premium-onboarding.ts',
  ];

  for (const item of removedPaths) assertMissing(item);

  const removedImportPattern = /@\/features\/(business-workspace|payments|premium|receipt-scans|store|subscription)|@\/pages\/(business-accountant|premium|receipt-scans)|@\/shared\/api\/premium|ReceiptPremiumLockSheet|PremiumUpgradeSheet|PremiumFeatureGate|ReceiptQuickAction/;
  for (const file of files) {
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const lines = read(file).split(/\r?\n/);
    lines.forEach((line, index) => {
      if (removedImportPattern.test(line)) addFinding('removed-surface-reference', file, 'removed Premium/Store/Business/Receipts frontend reference', index + 1);
    });
  }
}

function checkFirstRunLearningWiring() {
  assertFile('src/features/chat/ui/message/AssistantTypingText.tsx');
  assertFile('src/features/chat/model/firstRunChatSetup.store.ts');
  assertFile('src/features/onboarding/ui/LaunchOnboardingSheet.tsx');
  assertFile('src/features/onboarding/model/onboarding.store.ts');
  assertFile('src/app/styles/pages/onboarding-setup/onboarding-setup-launch.css');
  assertFile('src/app/styles/animations/chat-motion.css');

  assertMissing('src/features/product-tour');

  const dashboard = read(path.resolve(srcRoot, 'pages/dashboard/DashboardPage.tsx'));
  if (/data-product-tour=/.test(dashboard)) {
    addFinding('removed-product-tour-target', path.resolve(srcRoot, 'pages/dashboard/DashboardPage.tsx'), 'dashboard still contains product tour targets');
  }

  const indexCss = read(path.resolve(srcRoot, 'app/styles/index.css'));
  for (const css of ['onboarding-setup-launch.css', 'chat-motion.css', 'voice-permission-compact.css']) {
    if (!indexCss.includes(css)) addFinding('style-wiring', path.resolve(srcRoot, 'app/styles/index.css'), `${css} is not imported`);
  }
}

function checkNavigationIA() {
  const bottomNav = read(path.resolve(srcRoot, 'features/navigation/ui/AppBottomNavigation.tsx'));
  const navSheet = read(path.resolve(srcRoot, 'features/navigation/ui/AppNavigationSheet.tsx'));
  const router = read(path.resolve(srcRoot, 'app/router/AppRouter.tsx'));
  const topBar = read(path.resolve(srcRoot, 'shared/ui/ScreenTopBar.tsx'));

  for (const screen of ['dashboard', 'accounts', 'journal', 'analytics', 'profile']) {
    if (!bottomNav.includes(`screen: '${screen}'`)) addFinding('bottom-nav', path.resolve(srcRoot, 'features/navigation/ui/AppBottomNavigation.tsx'), `bottom nav missing ${screen}`);
    if (navSheet.includes(`screen: '${screen}'`)) addFinding('navigation-duplication', path.resolve(srcRoot, 'features/navigation/ui/AppNavigationSheet.tsx'), `menu duplicates bottom-nav screen ${screen}`);
  }

  for (const screen of ['goals', 'spending-limits', 'obligations', 'referral']) {
    if (!navSheet.includes(`screen: '${screen}'`)) addFinding('navigation-menu', path.resolve(srcRoot, 'features/navigation/ui/AppNavigationSheet.tsx'), `drawer menu missing ${screen}`);
  }

  if (!topBar.includes('MenuDotsIcon')) addFinding('top-bar-menu', path.resolve(srcRoot, 'shared/ui/ScreenTopBar.tsx'), 'top bar menu icon is missing');
  if (topBar.includes("['notifications', 'analytics', 'settings']")) addFinding('top-bar-analytics', path.resolve(srcRoot, 'shared/ui/ScreenTopBar.tsx'), 'top bar still uses analytics as default action');

  for (const removedScreen of ['store', 'premium', 'business', 'business-accountant', 'receipt-scans', 'sections']) {
    if (navSheet.includes(`screen: '${removedScreen}'`) || bottomNav.includes(`screen: '${removedScreen}'`) || router.includes(`currentScreen === '${removedScreen}'`)) {
      addFinding('removed-screen', path.resolve(srcRoot, 'features/navigation/ui/AppNavigationSheet.tsx'), `removed screen is still wired: ${removedScreen}`);
    }
  }
}

function checkLearningKeys() {
  const ru = read(path.resolve(srcRoot, 'shared/lib/i18n/locales/ru/onboarding.ts'));
  const en = read(path.resolve(srcRoot, 'shared/lib/i18n/locales/en/onboarding.ts'));
  for (const key of [
    'onboarding.entry.title',
    'onboarding.entry.caption',
    'onboarding.entry.start',
  ]) {
    if (!ru.includes(`'${key}'`)) addFinding('i18n-key', path.resolve(srcRoot, 'shared/lib/i18n/locales/ru/onboarding.ts'), `missing RU key: ${key}`);
    if (!en.includes(`'${key}'`)) addFinding('i18n-key', path.resolve(srcRoot, 'shared/lib/i18n/locales/en/onboarding.ts'), `missing EN key: ${key}`);
  }
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
checkRemovedProductSurfaces(files);
checkFirstRunLearningWiring();
checkNavigationIA();
checkLearningKeys();
checkNoLegacyOnboardingSteps(files);
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

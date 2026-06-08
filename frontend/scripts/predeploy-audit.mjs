#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const frontendRoot = process.cwd();
const srcRoot = path.join(frontendRoot, 'src');
const stylesRoot = path.join(srcRoot, 'app', 'styles');
const reportRoot = path.join(frontendRoot, 'reports', 'predeploy-audit');

const args = new Set(process.argv.slice(2));
const strict = args.has('--strict');

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.html']);
const CSS_EXTENSIONS = new Set(['.css']);
const IGNORE_DIRS = new Set(['node_modules', 'dist', 'build', '.git', 'reports', 'coverage']);
const EXCLUDED_TEXT_FILES = [
  normalizePath(path.join('src', 'shared', 'lib', 'i18n.ts')),
  normalizePath(path.join('src', 'shared', 'lib', 'i18n.extra.ts')),
];

const TECH_WORDS = [
  'admin-only',
  'frontend',
  'backend',
  'api',
  'debug',
  'mock',
  'feature flag',
  'feature flags',
  'feature',
  'usage',
  'usage limit',
  'usage limits',
  'subscription model',
  'roadmap',
  'runtime',
  'legacy',
  'stt',
  'beta',
  'test access',
  'grant test access',
  'target',
];

const SAFE_TECH_FILE_PATTERNS = [
  /\/scripts\//,
  /\/api\//,
  /\/model\//,
  /\/lib\//,
  /\/types?\./,
  /\.api\./,
  /\.store\./,
  /i18n\.ts$/,
  /i18n\.extra\.ts$/,
];

const FORBIDDEN_CSS_NAME_PARTS = [
  'runtime',
  'legacy',
  'premium-admin',
  'fix-2',
  'temporary',
  'temp',
];

function normalizePath(value) {
  return value.split(path.sep).join('/');
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath, files);
    else files.push(fullPath);
  }
  return files;
}

function rel(filePath) {
  return normalizePath(path.relative(frontendRoot, filePath));
}

function readLines(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
}

function ensureReportDir() {
  fs.mkdirSync(reportRoot, { recursive: true });
}

function isExcludedTextFile(filePath) {
  const relative = rel(filePath);
  return EXCLUDED_TEXT_FILES.includes(relative);
}

function stripLineNoise(line) {
  return line
    .replace(/\/\/.*$/g, '')
    .replace(/\/\*.*?\*\//g, '')
    .trim();
}

function looksLikeUserVisibleLine(line) {
  const clean = stripLineNoise(line);
  if (!clean) return false;
  if (/^(import|export)\s/.test(clean)) return false;
  if (/console\.(log|warn|error|info|debug)\(/.test(clean)) return false;
  if (/throw new Error\(/.test(clean)) return false;
  if (/aria-label=/.test(clean)) return true;
  if (/<[A-Za-z][^>]*>/.test(clean)) return true;
  if (/placeholder=/.test(clean)) return true;
  if (/title=/.test(clean)) return true;
  if (/label[:=]/i.test(clean)) return true;
  if (/message[:=]/i.test(clean)) return true;
  if (/description[:=]/i.test(clean)) return true;
  if (/caption[:=]/i.test(clean)) return true;
  if (/button[:=]/i.test(clean)) return true;
  if (/toast/i.test(clean)) return true;
  return /['"`][^'"`]*[А-Яа-яЁё][^'"`]*['"`]/.test(clean);
}

function collectHardcodedRussian(files) {
  const findings = [];
  for (const file of files) {
    const ext = path.extname(file);
    if (!SOURCE_EXTENSIONS.has(ext)) continue;
    if (isExcludedTextFile(file)) continue;
    const relative = rel(file);
    const lines = readLines(file);
    lines.forEach((line, index) => {
      if (!/[А-Яа-яЁё]/.test(line)) return;
      if (!looksLikeUserVisibleLine(line)) return;
      findings.push({
        file: relative,
        line: index + 1,
        text: line.trim().slice(0, 240),
      });
    });
  }
  return findings;
}

function collectTechnicalWords(files) {
  const findings = [];
  const wordRegexes = TECH_WORDS.map((word) => ({
    word,
    regex: new RegExp(`\\b${escapeRegex(word)}\\b`, 'i'),
  }));

  for (const file of files) {
    const ext = path.extname(file);
    if (!SOURCE_EXTENSIONS.has(ext)) continue;
    const relative = rel(file);
    const normalized = `/${relative}`;
    const isLikelyTechnicalFile = SAFE_TECH_FILE_PATTERNS.some((pattern) => pattern.test(normalized));
    const lines = readLines(file);

    lines.forEach((line, index) => {
      const clean = stripLineNoise(line);
      if (!clean) return;
      if (isLikelyTechnicalFile && !/<[A-Za-z][^>]*>|aria-label=|placeholder=|title=|label[:=]|message[:=]|description[:=]|caption[:=]/i.test(clean)) {
        return;
      }
      for (const { word, regex } of wordRegexes) {
        if (!regex.test(clean)) continue;
        findings.push({
          file: relative,
          line: index + 1,
          word,
          text: clean.slice(0, 240),
        });
      }
    });
  }
  return findings;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collectTranslationKeyLeaks(files) {
  const findings = [];
  const keyRegex = /['"`]([a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*){1,5})['"`]/g;
  const commonPrefixes = new Set([
    'limits', 'store', 'premium', 'business', 'receipt', 'referral', 'analytics', 'common', 'voice', 'chat', 'settings', 'dashboard', 'accounts', 'transactions', 'onboarding', 'subscription', 'payments', 'reports', 'admin'
  ]);

  for (const file of files) {
    const ext = path.extname(file);
    if (!SOURCE_EXTENSIONS.has(ext)) continue;
    if (isExcludedTextFile(file)) continue;
    const relative = rel(file);
    const lines = readLines(file);
    lines.forEach((line, index) => {
      const clean = stripLineNoise(line);
      if (!clean) return;
      let match;
      while ((match = keyRegex.exec(clean)) !== null) {
        const key = match[1];
        const prefix = key.split('.')[0];
        if (!commonPrefixes.has(prefix)) continue;
        const isExpectedTranslationCall = new RegExp(`\\b(t|rt)\\(\\s*['"\`]${escapeRegex(key)}['"\`]`).test(clean);
        const isKeyDeclaration = /:\s*['"`]/.test(clean) && /\b[a-z][a-z0-9]*\b/.test(clean);
        if (isExpectedTranslationCall || isKeyDeclaration) continue;
        findings.push({ file: relative, line: index + 1, key, text: clean.slice(0, 240) });
      }
    });
  }
  return findings;
}

function collectCssStructureFindings() {
  const findings = [];
  const cssFiles = walk(stylesRoot).filter((file) => CSS_EXTENSIONS.has(path.extname(file)));
  const indexPath = path.join(stylesRoot, 'index.css');
  const indexContent = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';
  const imported = new Set();

  for (const match of indexContent.matchAll(/@import\s+['"](.+?\.css)['"]/g)) {
    imported.add(normalizePath(path.normalize(path.join(stylesRoot, match[1]))));
  }

  for (const file of cssFiles) {
    const relative = rel(file);
    const base = path.basename(file).toLowerCase();
    const normalized = normalizePath(file);
    const isIndex = normalized === normalizePath(indexPath);

    for (const part of FORBIDDEN_CSS_NAME_PARTS) {
      if (base.includes(part)) {
        findings.push({ type: 'forbidden-css-name', file: relative, detail: `name contains "${part}"` });
      }
    }

    if (/^\d+[a-z-]*\.css$/i.test(base)) {
      findings.push({ type: 'numeric-flat-css-name', file: relative, detail: 'numeric CSS filename remains' });
    }

    if (!isIndex && !imported.has(normalized)) {
      findings.push({ type: 'css-not-imported-by-manifest', file: relative, detail: 'not imported from src/app/styles/index.css' });
    }
  }

  for (const importedPath of imported) {
    if (!fs.existsSync(importedPath)) {
      findings.push({ type: 'missing-css-import', file: rel(importedPath), detail: 'imported from index.css but file does not exist' });
    }
  }

  return findings;
}

function collectLargeFiles(files) {
  const findings = [];
  const thresholds = {
    '.tsx': 360,
    '.ts': 420,
    '.css': 420,
  };
  for (const file of files) {
    const ext = path.extname(file);
    if (!(ext in thresholds)) continue;
    const lines = readLines(file).length;
    if (lines < thresholds[ext]) continue;
    findings.push({ file: rel(file), lines, threshold: thresholds[ext] });
  }
  return findings.sort((a, b) => b.lines - a.lines);
}

function collectEnvLeaks(files) {
  const findings = [];
  for (const file of files) {
    const relative = rel(file);
    if (!/\.env(\.|$)/.test(path.basename(file))) continue;
    if (/\.env\.example$/.test(relative)) continue;
    findings.push({ file: relative, detail: 'real env file should not be in archive/repository' });
  }
  return findings;
}

function writeJson(name, data) {
  fs.writeFileSync(path.join(reportRoot, `${name}.json`), JSON.stringify(data, null, 2));
}

function markdownTable(items, columns) {
  if (!items.length) return 'Нет найденных проблем.\n';
  const header = `| ${columns.join(' | ')} |`;
  const sep = `| ${columns.map(() => '---').join(' | ')} |`;
  const rows = items.map((item) => `| ${columns.map((column) => String(item[column] ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 220)).join(' | ')} |`);
  return [header, sep, ...rows].join('\n') + '\n';
}

function writeMarkdown(summary) {
  const lines = [];
  lines.push('# Predeploy audit report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Hardcoded Russian candidates: ${summary.hardcodedRussian.length}`);
  lines.push(`- Technical/user-visible word candidates: ${summary.technicalWords.length}`);
  lines.push(`- Translation key leak candidates: ${summary.translationKeyLeaks.length}`);
  lines.push(`- CSS structure findings: ${summary.cssStructure.length}`);
  lines.push(`- Large files: ${summary.largeFiles.length}`);
  lines.push(`- Env leaks: ${summary.envLeaks.length}`);
  lines.push('');
  lines.push('## Hardcoded Russian candidates');
  lines.push(markdownTable(summary.hardcodedRussian.slice(0, 200), ['file', 'line', 'text']));
  lines.push('## Technical/user-visible word candidates');
  lines.push(markdownTable(summary.technicalWords.slice(0, 200), ['file', 'line', 'word', 'text']));
  lines.push('## Translation key leak candidates');
  lines.push(markdownTable(summary.translationKeyLeaks.slice(0, 200), ['file', 'line', 'key', 'text']));
  lines.push('## CSS structure findings');
  lines.push(markdownTable(summary.cssStructure.slice(0, 300), ['type', 'file', 'detail']));
  lines.push('## Large files');
  lines.push(markdownTable(summary.largeFiles.slice(0, 120), ['file', 'lines', 'threshold']));
  lines.push('## Env leaks');
  lines.push(markdownTable(summary.envLeaks, ['file', 'detail']));
  fs.writeFileSync(path.join(reportRoot, 'predeploy-audit.md'), lines.join('\n'));
}

function main() {
  ensureReportDir();
  const allFiles = walk(frontendRoot);
  const sourceFiles = walk(srcRoot);

  const summary = {
    hardcodedRussian: collectHardcodedRussian(sourceFiles),
    technicalWords: collectTechnicalWords(sourceFiles),
    translationKeyLeaks: collectTranslationKeyLeaks(sourceFiles),
    cssStructure: collectCssStructureFindings(),
    largeFiles: collectLargeFiles(sourceFiles),
    envLeaks: collectEnvLeaks(allFiles),
  };

  writeJson('hardcoded-russian', summary.hardcodedRussian);
  writeJson('technical-words', summary.technicalWords);
  writeJson('translation-key-leaks', summary.translationKeyLeaks);
  writeJson('css-structure', summary.cssStructure);
  writeJson('large-files', summary.largeFiles);
  writeJson('env-leaks', summary.envLeaks);
  writeJson('summary', {
    hardcodedRussian: summary.hardcodedRussian.length,
    technicalWords: summary.technicalWords.length,
    translationKeyLeaks: summary.translationKeyLeaks.length,
    cssStructure: summary.cssStructure.length,
    largeFiles: summary.largeFiles.length,
    envLeaks: summary.envLeaks.length,
  });
  writeMarkdown(summary);

  console.log('Predeploy audit complete.');
  console.log(`Report: ${path.join('reports', 'predeploy-audit', 'predeploy-audit.md')}`);
  console.log(`Hardcoded Russian candidates: ${summary.hardcodedRussian.length}`);
  console.log(`Technical word candidates: ${summary.technicalWords.length}`);
  console.log(`Translation key leak candidates: ${summary.translationKeyLeaks.length}`);
  console.log(`CSS structure findings: ${summary.cssStructure.length}`);
  console.log(`Large files: ${summary.largeFiles.length}`);
  console.log(`Env leaks: ${summary.envLeaks.length}`);

  const blockingCount = summary.cssStructure.length + summary.envLeaks.length;
  if (strict && blockingCount > 0) {
    console.error(`Strict mode failed: ${blockingCount} blocking findings.`);
    process.exit(1);
  }
}

main();

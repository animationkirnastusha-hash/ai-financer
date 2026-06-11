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

const EXCLUDED_TEXT_PATH_PREFIXES = [
  normalizePath(path.join('src', 'shared', 'lib', 'i18n', 'locales')) + '/',
];

const HARD_CODED_RUSSIAN_DATA_FILE_PATTERNS = [
  /\/categoryIcons\.ts$/,
  /\/currency\.ts$/,
  /\/parse[A-Z][A-Za-z]+Intent\.ts$/,
  /\/taxonomy-icons\.ts$/,
  /\/features\/sections\/lib\/taxonomy\/rules\/.*\.ts$/,
];

const TECH_WORDS = [
  'admin-only',
  'debug',
  'mock',
  'feature flag',
  'feature flags',
  'subscription model',
  'roadmap',
  'runtime',
  'legacy',
  'test access',
  'grant test access',
];

const TECH_WORD_REGEXES = [
  ...TECH_WORDS.map((word) => ({ word, regex: new RegExp(`\\b${escapeRegex(word)}\\b`, 'i') })),
  { word: 'API', regex: /\bAPI\b/ },
  { word: 'STT', regex: /\bSTT\b/ },
  { word: 'frontend', regex: /\bfrontend\b/ },
  { word: 'backend', regex: /\bbackend\b/ },
  { word: 'beta', regex: /\bbeta\b/i },
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
  return EXCLUDED_TEXT_FILES.includes(relative) || EXCLUDED_TEXT_PATH_PREFIXES.some((prefix) => relative.startsWith(prefix));
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
    const normalized = `/${relative}`;
    if (HARD_CODED_RUSSIAN_DATA_FILE_PATTERNS.some((pattern) => pattern.test(normalized))) continue;
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

function isLikelyCodeOnlyLine(clean) {
  if (!clean) return true;
  if (/^(import|export)\b/.test(clean)) return true;
  if (/^type\b|^interface\b|^const\b|^let\b|^var\b|^function\b|^return\b/.test(clean) && !/<[A-Za-z][^>]*>/.test(clean)) return true;
  if (/event\.target|\.target\.|target=\"_blank\"|target=\{/.test(clean)) return true;
  if (/^<button\b/.test(clean) && !/>[^<]*(API|backend|frontend|STT|mock|debug|roadmap|runtime|legacy|beta|admin-only|test access|grant test access|subscription model)[^<]*</i.test(clean)) return true;
  if (/from ['"].+\.api['"]/.test(clean)) return true;
  if (/apiClient\.|\.api['"]|\/api\//i.test(clean) && !/['"`][^'"`]*(API|backend|frontend|STT|mock|debug|roadmap)[^'"`]*['"`]/.test(clean)) return true;
  if (/^if\s*\(|^switch\s*\(|^return\s+[a-zA-Z0-9_?.]+/.test(clean) && !/<[A-Za-z][^>]*>/.test(clean)) return true;
  return false;
}

function isLikelyUserVisibleTechnicalLine(clean) {
  if (isLikelyCodeOnlyLine(clean)) return false;
  if (/<[A-Za-z][^>]*>/.test(clean)) return true;
  if (/aria-label=|placeholder=|title=|label[:=]|message[:=]|description[:=]|caption[:=]|toast/i.test(clean)) return true;
  if (/\bt\(\s*['"`]/.test(clean)) return false;
  return /['"`][^'"`]*(API|backend|frontend|STT|mock|debug|roadmap|runtime|legacy|beta|admin-only|test access|grant test access|subscription model)[^'"`]*['"`]/i.test(clean);
}

function collectTechnicalWords(files) {
  const findings = [];

  for (const file of files) {
    const ext = path.extname(file);
    if (!SOURCE_EXTENSIONS.has(ext)) continue;
    const relative = rel(file);
    if (/\/api\/|\.api\./.test(`/${relative}`)) continue;
    const lines = readLines(file);

    lines.forEach((line, index) => {
      const clean = stripLineNoise(line);
      if (!isLikelyUserVisibleTechnicalLine(clean)) return;
      for (const { word, regex } of TECH_WORD_REGEXES) {
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

function isSafeTranslationKeyReference(clean, key) {
  const escaped = escapeRegex(key);
  if (new RegExp('\\b(t|rt)\\(\\s*[\'\"`]' + escaped + '[\'\"`]').test(clean)) return true;
  if (new RegExp('\\bfilename\\s*=\\s*[\'\"`]' + escaped + '[\'\"`]').test(clean)) return true;
  if (/^\s*['"`][a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*){1,5}['"`]\s*,?\s*$/.test(clean)) return true;
  if (/^\s*[a-zA-Z0-9_$]+:\s*['"`][a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*){1,5}['"`]\s*,?\s*$/.test(clean)) return true;
  if (/\b(labelKey|captionKey|title|caption|label|key):\s*['"`][a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*){1,5}['"`]/.test(clean)) return true;
  if (/Array<.*Key|labelKey|captionKey/.test(clean)) return true;
  if (/^if\s*\(|^switch\s*\(|^case\s+/.test(clean)) return true;
  if (/\.includes\(|\.startsWith\(|\.endsWith\(|===|!==/.test(clean)) return true;
  if (/key\s*=|id\s*=|name\s*=/.test(clean) && !/<[A-Za-z][^>]*>/.test(clean)) return true;
  return false;
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
        if (isSafeTranslationKeyReference(clean, key)) continue;
        findings.push({ file: relative, line: index + 1, key, text: clean.slice(0, 240) });
      }
    });
  }
  return findings;
}

function collectCssImports(cssFile, reachable, missing, stack = new Set()) {
  const normalizedFile = normalizePath(cssFile);
  if (stack.has(normalizedFile)) return;
  stack.add(normalizedFile);

  if (!fs.existsSync(cssFile)) {
    missing.add(normalizedFile);
    stack.delete(normalizedFile);
    return;
  }

  reachable.add(normalizedFile);
  const content = fs.readFileSync(cssFile, 'utf8');
  const cssDir = path.dirname(cssFile);

  for (const match of content.matchAll(/@import\s+(?:url\()?['"]?(.+?\.css)['"]?\)?/g)) {
    const importPath = match[1];
    if (/^(https?:)?\/\//i.test(importPath)) continue;
    const resolved = path.normalize(path.join(cssDir, importPath));
    collectCssImports(resolved, reachable, missing, stack);
  }

  stack.delete(normalizedFile);
}

function collectCssStructureFindings() {
  const findings = [];
  const cssFiles = walk(stylesRoot).filter((file) => CSS_EXTENSIONS.has(path.extname(file)));
  const indexPath = path.join(stylesRoot, 'index.css');
  const reachable = new Set();
  const missing = new Set();

  collectCssImports(indexPath, reachable, missing);

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

    if (!isIndex && !reachable.has(normalized)) {
      findings.push({ type: 'css-not-imported-by-manifest', file: relative, detail: 'not reachable from src/app/styles/index.css imports' });
    }
  }

  for (const missingPath of missing) {
    findings.push({ type: 'missing-css-import', file: rel(missingPath), detail: 'imported from CSS manifest chain but file does not exist' });
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

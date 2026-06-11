#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const frontendRoot = process.cwd();
const stylesDir = path.resolve(frontendRoot, 'src/app/styles');
const reportDir = path.resolve(frontendRoot, 'reports/css-audit');
const indexPath = path.join(stylesDir, 'index.css');
const args = new Set(process.argv.slice(2));
const strict = args.has('--strict');

const IGNORE_DIRS = new Set(['node_modules', 'dist', 'build', '.git', 'reports', 'coverage']);
const MAX_LINES = Number(process.env.CSS_AUDIT_MAX_LINES || 520);
const MAX_IMPORTANT = Number(process.env.CSS_AUDIT_MAX_IMPORTANT || 35);
const MAX_ROOT_CSS_FILES = Number(process.env.CSS_AUDIT_MAX_ROOT_CSS_FILES || 1);

function normalize(value) {
  return value.split(path.sep).join('/');
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath, files);
    else if (entry.name.endsWith('.css')) files.push(fullPath);
  }
  return files;
}

function relative(filePath) {
  return normalize(path.relative(frontendRoot, filePath));
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function collectManifestImports() {
  const imported = new Set();
  const missingImports = [];
  const visited = new Set();

  function collectFrom(filePath, sourceLabel) {
    const normalizedFile = normalize(filePath);
    if (visited.has(normalizedFile)) return;
    visited.add(normalizedFile);

    if (!fs.existsSync(filePath)) {
      missingImports.push({ file: relative(filePath), detail: `imported from ${sourceLabel} but file does not exist` });
      return;
    }

    const fileText = read(filePath);
    const baseDir = path.dirname(filePath);
    for (const match of fileText.matchAll(/@import\s+["'](.+?\.css)["'];?/g)) {
      const absolutePath = path.normalize(path.join(baseDir, match[1]));
      const normalizedImport = normalize(absolutePath);
      imported.add(normalizedImport);
      collectFrom(absolutePath, relative(filePath));
    }
  }

  if (!fs.existsSync(indexPath)) {
    return { imported, missingImports: [{ file: relative(indexPath), detail: 'src/app/styles/index.css is missing' }] };
  }

  collectFrom(indexPath, 'src/app/styles/index.css');
  return { imported, missingImports };
}

function ensureReportDir() {
  fs.mkdirSync(reportDir, { recursive: true });
}

function main() {
  ensureReportDir();
  const cssFiles = walk(stylesDir).sort((a, b) => relative(a).localeCompare(relative(b)));
  const { imported, missingImports } = collectManifestImports();
  const rows = [];
  const problems = [];
  let totalLines = 0;
  let totalImportant = 0;

  for (const file of cssFiles) {
    const text = read(file);
    const lines = text.split(/\r?\n/).length;
    const important = (text.match(/!important/g) || []).length;
    const rel = relative(file);
    const normalized = normalize(file);
    const isManifest = normalized === normalize(indexPath);
    const isRootCss = path.dirname(file) === stylesDir;

    totalLines += lines;
    totalImportant += important;
    rows.push({ file: rel, lines, important });

    if (lines > MAX_LINES) {
      problems.push({ type: 'oversized-css', file: rel, lines, limit: MAX_LINES });
    }
    if (important > MAX_IMPORTANT) {
      problems.push({ type: 'too-many-important', file: rel, important, limit: MAX_IMPORTANT });
    }
    if (!isManifest && !imported.has(normalized)) {
      problems.push({ type: 'orphan-css', file: rel, detail: 'not imported from src/app/styles/index.css' });
    }
    if (isRootCss && !isManifest) {
      problems.push({ type: 'flat-root-css', file: rel, detail: 'root styles folder should contain only index.css; move to a logical subfolder' });
    }
  }

  for (const item of missingImports) problems.push({ type: 'missing-css-import', ...item });

  const rootCssFiles = cssFiles.filter((file) => path.dirname(file) === stylesDir && normalize(file) !== normalize(indexPath));
  if (rootCssFiles.length > MAX_ROOT_CSS_FILES) {
    problems.push({
      type: 'too-many-root-css-files',
      file: 'src/app/styles',
      detail: `${rootCssFiles.length} root CSS files; expected ${MAX_ROOT_CSS_FILES} or fewer`,
    });
  }

  const summary = {
    cssFiles: cssFiles.length,
    totalLines,
    totalImportant,
    problems: problems.length,
    maxLines: MAX_LINES,
    maxImportant: MAX_IMPORTANT,
  };

  fs.writeFileSync(path.join(reportDir, 'css-audit.json'), JSON.stringify({ summary, files: rows, problems }, null, 2));
  const markdown = [
    '# CSS audit report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    `- CSS files: ${summary.cssFiles}`,
    `- Total lines: ${summary.totalLines}`,
    `- Total !important: ${summary.totalImportant}`,
    `- Problems: ${summary.problems}`,
    `- Max lines per file: ${summary.maxLines}`,
    `- Max !important per file: ${summary.maxImportant}`,
    '',
    '## Problems',
    '',
    problems.length
      ? ['| Type | File | Detail |', '| --- | --- | --- |', ...problems.map((item) => `| ${item.type} | ${item.file} | ${item.detail || item.lines || item.important || ''} |`)].join('\n')
      : 'No blocking CSS findings.',
    '',
    '## Files',
    '',
    '| File | Lines | !important |',
    '| --- | ---: | ---: |',
    ...rows.map((row) => `| ${row.file} | ${row.lines} | ${row.important} |`),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(reportDir, 'css-audit.md'), markdown);

  console.log('CSS audit complete.');
  console.log(`Report: ${path.join('reports', 'css-audit', 'css-audit.md')}`);
  console.log(`CSS files: ${summary.cssFiles}`);
  console.log(`Total CSS lines: ${summary.totalLines}`);
  console.log(`Total !important: ${summary.totalImportant}`);
  console.log(`Problems: ${summary.problems}`);

  if ((strict || process.env.CSS_AUDIT_STRICT === '1') && problems.length > 0) {
    console.error(`CSS audit failed: ${problems.length} blocking finding(s).`);
    process.exit(1);
  }
}

main();

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const src = path.join(root, 'src');
const allowedFiles = new Set([
  'src/shared/lib/i18n.ts',
  'src/shared/lib/i18n.extra.ts',
  'src/features/currency/lib/currency.ts',
  'src/features/transactions/lib/autoCategory.ts',
  'src/features/sections/lib/categoryIcons.ts',
  'src/features/voice/model/voiceSttLexicon.ts',
]);
const allowedFragments = [
  'console.', 'throw new Error', 'telegram', 'Telegram', 'OpenAI', 'STT', 'Fina', 'Фина',
  'создай ', 'кофе ', 'доход ', 'переведи ', 'сколько ',
];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(tsx|ts)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const problems = [];
for (const file of walk(src)) {
  const rel = path.relative(root, file).replaceAll('\\', '/');
  if (allowedFiles.has(rel)) continue;
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!/[А-Яа-яЁё]/.test(line)) return;
    if (allowedFragments.some((fragment) => line.includes(fragment))) return;
    if (line.trim().startsWith('//')) return;
    problems.push({ file: rel, line: index + 1, text: line.trim().slice(0, 180) });
  });
}

if (problems.length === 0) {
  console.log('i18n audit passed: no uncontrolled Russian UI literals found.');
  process.exit(0);
}

console.table(problems.slice(0, 80));
console.log(`i18n audit found ${problems.length} Russian literals outside dictionaries.`);
if (process.argv.includes('--strict')) process.exit(1);

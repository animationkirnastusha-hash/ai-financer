import fs from 'node:fs';
import path from 'node:path';

const stylesDir = path.resolve('src/app/styles');
const files = fs.readdirSync(stylesDir).filter((name) => name.endsWith('.css')).sort();
let totalLines = 0;
let totalImportant = 0;
const rows = [];
for (const file of files) {
  const fullPath = path.join(stylesDir, file);
  const text = fs.readFileSync(fullPath, 'utf8');
  const lines = text.split(/\r?\n/).length;
  const important = (text.match(/!important/g) || []).length;
  totalLines += lines;
  totalImportant += important;
  rows.push({ file, lines, important });
}
console.table(rows);
console.log(`Total CSS lines: ${totalLines}`);
console.log(`Total !important: ${totalImportant}`);
const heavy = rows.filter((row) => row.lines > 700 || row.important > 80);
if (heavy.length) {
  console.error('CSS audit failed: oversized or too many !important rules:', heavy);
  process.exitCode = 1;
}

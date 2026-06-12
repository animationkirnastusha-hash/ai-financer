#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import { normalizeMoneyAmount } from '../src/modules/ai/utils/amount-normalizer';

interface Case {
  label: string;
  value: unknown;
  expected: number | null;
}

const moneyCases: Case[] = [
  { label: 'plain integer number', value: 23450, expected: 23450 },
  { label: 'plain integer string', value: '23450', expected: 23450 },
  { label: 'space thousands', value: '23 450', expected: 23450 },
  { label: 'comma thousands', value: '23,450', expected: 23450 },
  { label: 'dot thousands', value: '23.450', expected: 23450 },
  { label: 'rub suffix', value: '23 450 рублей', expected: 23450 },
  { label: 'compact k cyrillic', value: '20к', expected: 20000 },
  { label: 'compact k latin with space', value: '20 k', expected: 20000 },
  { label: 'compact thousands short', value: '20 тыс', expected: 20000 },
  { label: 'compact thousands dotted', value: '20 тыс.', expected: 20000 },
  { label: 'compact thousands long', value: '20 тысяч', expected: 20000 },
  { label: 'decimal comma compact', value: '1,5к', expected: 1500 },
  { label: 'decimal dot compact', value: '1.5к', expected: 1500 },
  { label: 'large goal amount', value: '120 тыс', expected: 120000 },
  { label: 'million cyrillic', value: '1,2 млн', expected: 1200000 },
];

const nonMoneyCases: Case[] = [
  { label: 'days phrase', value: '3 дня', expected: null },
  { label: 'months phrase', value: '12 месяцев', expected: null },
  { label: 'percent phrase', value: '15%', expected: null },
  { label: 'payment day phrase', value: '20 число месяца', expected: null },
  { label: 'empty string', value: '', expected: null },
  { label: 'random text', value: 'кофе на районе', expected: null },
];

const requiredValidatorSnippets = [
  'normalizeMoneyAmount(input.initialBalance)',
  'normalizeMoneyAmount(input.balance)',
  'normalizeMoneyAmount(input.amount)',
  'normalizeMoneyAmount(input.principalAmount || input.amount)',
  'normalizeMoneyAmount(input.currentDebt)',
  'normalizeMoneyAmount(input.monthlyPayment || input.payment)',
  'normalizeMoneyAmount(input.targetAmount || input.amount)',
  'normalizeMoneyAmount(input.currentAmount)',
];

let failed = false;

function checkCase(testCase: Case) {
  const actual = normalizeMoneyAmount(testCase.value);
  if (actual !== testCase.expected) {
    failed = true;
    console.error(`✕ ${testCase.label}: expected ${testCase.expected}, received ${actual}`);
    return;
  }
  console.log(`✓ ${testCase.label}: ${String(testCase.value)} -> ${actual}`);
}

console.log('AI money contract normalization tests');
console.log('');

for (const testCase of moneyCases) checkCase(testCase);
for (const testCase of nonMoneyCases) checkCase(testCase);

const validatorPath = path.resolve(process.cwd(), 'src/modules/ai/ai-validator.service.ts');
const validatorSource = fs.readFileSync(validatorPath, 'utf8');

console.log('');
console.log('Validator money-field coverage');

for (const snippet of requiredValidatorSnippets) {
  if (!validatorSource.includes(snippet)) {
    failed = true;
    console.error(`✕ missing validator normalization: ${snippet}`);
  } else {
    console.log(`✓ ${snippet}`);
  }
}

if (failed) {
  console.error('');
  console.error('AI money contract normalization tests failed.');
  process.exit(1);
}

console.log('');
console.log('AI money contract normalization tests passed.');

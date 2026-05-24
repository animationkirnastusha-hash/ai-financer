import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMoneyAmount } from '../utils/amount-normalizer';

test('normalizeMoneyAmount accepts only structured numeric values', () => {
  assert.equal(normalizeMoneyAmount(30000), 30000);
  assert.equal(normalizeMoneyAmount('30000'), 30000);
  assert.equal(normalizeMoneyAmount('300.50'), 301);
  assert.equal(normalizeMoneyAmount('300,50'), 301);
});

test('normalizeMoneyAmount does not parse natural-language finance commands', () => {
  assert.equal(normalizeMoneyAmount('кофе 300'), null);
  assert.equal(normalizeMoneyAmount('5к'), null);
  assert.equal(normalizeMoneyAmount('50 тысяч рублей'), null);
  assert.equal(normalizeMoneyAmount('наличка 35 тысяч рублей'), null);
});

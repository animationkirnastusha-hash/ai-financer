import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeMoneyAmount } from '../utils/amount-normalizer';

test('amount normalizer accepts only structured numeric contract values', () => {
  assert.equal(normalizeMoneyAmount(30000), 30000);
  assert.equal(normalizeMoneyAmount('30000'), 30000);
  assert.equal(normalizeMoneyAmount('30000.40'), 30000);
  assert.equal(normalizeMoneyAmount('30000,40'), 30000);
});

test('amount normalizer does not parse natural-language financial commands', () => {
  assert.equal(normalizeMoneyAmount('кофе 300 наличка'), null);
  assert.equal(normalizeMoneyAmount('наличка 35 тысяч рублей'), null);
  assert.equal(normalizeMoneyAmount('5к'), null);
  assert.equal(normalizeMoneyAmount('50 тысяч рублей'), null);
});

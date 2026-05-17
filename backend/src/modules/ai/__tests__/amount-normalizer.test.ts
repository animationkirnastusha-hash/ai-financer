import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeMoneyAmount } from '../utils/amount-normalizer';

test('amount normalizer keeps numeric thousands', () => {
  assert.equal(normalizeMoneyAmount('30 000 руб.'), 30000);
  assert.equal(normalizeMoneyAmount('30000'), 30000);
  assert.equal(normalizeMoneyAmount('5к'), 5000);
  assert.equal(normalizeMoneyAmount('50 тысяч рублей'), 50000);
});

test('amount normalizer does not read k from account names', () => {
  assert.equal(normalizeMoneyAmount('кофе 300 наличка'), 300);
  assert.equal(normalizeMoneyAmount('наличка 35 тысяч рублей'), 35000);
});

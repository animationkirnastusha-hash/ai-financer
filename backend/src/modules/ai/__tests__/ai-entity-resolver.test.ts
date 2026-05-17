import assert from 'node:assert/strict';
import test from 'node:test';
import { AIEntityResolverService } from '../ai-entity-resolver.service';

const accounts = [
  { id: '1', name: 'Наличка', type: 'cash', currency: 'RUB', balance: 1000 },
  { id: '2', name: 'Основная карта', type: 'card', currency: 'RUB', balance: 1000 },
];

test('entity resolver matches account aliases', () => {
  const resolver = new AIEntityResolverService();

  assert.equal(resolver.resolveAccount(accounts, 'наличные')?.item.id, '1');
  assert.equal(resolver.resolveAccount(accounts, 'cash')?.item.id, '1');
  assert.equal(resolver.resolveAccount(accounts, 'основной')?.item.id, '2');
});

test('entity resolver rejects weak matches', () => {
  const resolver = new AIEntityResolverService();
  assert.equal(resolver.resolveAccount(accounts, 'абракадабра'), null);
});

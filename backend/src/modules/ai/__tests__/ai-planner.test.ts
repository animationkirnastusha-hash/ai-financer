import assert from 'node:assert/strict';
import test from 'node:test';
import { AIPlannerService } from '../ai-planner.service';
import { FakeAIProvider } from '../test-utils/fake-ai-provider';

test('planner normalizes DeepSeek create account + income plan', async () => {
  const planner = new AIPlannerService();
  const provider = new FakeAIProvider([
    {
      mode: 'actions',
      summary: 'Создать счет и внести деньги',
      actions: [
        { tool: 'create_account', input: { name: 'Тест', type: 'cash', currency: 'RUB', initialBalance: 5000 } },
        { tool: 'create_transaction', input: { kind: 'income', amount: '5000 руб', account: 'Тест', currency: 'RUB' } },
      ],
    },
  ]);

  (planner as unknown as { provider: FakeAIProvider }).provider = provider;

  const plan = await planner.plan('Создай счет тест и положи туда 5000 руб.', {
    accounts: [],
    categories: [],
    memory: { accountAliases: [] },
  });

  assert.equal(plan.mode, 'actions');
  assert.deepEqual(plan.actions.map((action) => action.tool), ['create_account', 'create_transaction']);
  assert.equal(plan.actions[0].input.__userText, 'Создай счет тест и положи туда 5000 руб.');
});

test('planner returns empty actions when model returns unsupported tools', async () => {
  const planner = new AIPlannerService();
  const provider = new FakeAIProvider([
    {
      actions: [
        { tool: 'dangerous_sql', input: { query: 'drop table users' } },
      ],
    },
  ]);

  (planner as unknown as { provider: FakeAIProvider }).provider = provider;

  const plan = await planner.plan('сделай что-то странное', {});
  assert.equal(plan.actions.length, 0);
});

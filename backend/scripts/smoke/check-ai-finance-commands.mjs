import { runSmoke } from './lib/test-context.mjs';
import { requestJson, unwrapArray } from './lib/http-client.mjs';

const MONEY = 'RUB';

function fail(message, data) {
  const suffix = data === undefined ? '' : `\n${JSON.stringify(data, null, 2)}`;
  throw new Error(`${message}${suffix}`);
}

function text(value) {
  return String(value ?? '').trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function includesAny(value, needles) {
  const clean = lower(value);
  return needles.some((needle) => clean.includes(lower(needle)));
}

function actionList(payload) {
  const actions = payload?.parsed?.actions;
  return Array.isArray(actions) ? actions : [];
}

function firstAction(payload) {
  const actions = actionList(payload);
  if (!actions.length) fail('AI response has no actions', payload);
  return actions[0];
}

function requireSingleAction(payload, label) {
  const actions = actionList(payload);
  if (actions.length !== 1) fail(`${label}: expected one action, got ${actions.length}`, payload);
  return actions[0];
}

function requireTool(action, expected, label) {
  const expectedTools = Array.isArray(expected) ? expected : [expected];
  if (!expectedTools.includes(action?.tool)) {
    fail(`${label}: expected tool ${expectedTools.join(' or ')}, got ${action?.tool}`, action);
  }
}

function requireAmount(action, expected, label) {
  const amount = asNumber(action?.input?.amount ?? action?.input?.targetAmount);
  if (amount === null || Math.abs(amount - expected) > 0.01) {
    fail(`${label}: expected amount ${expected}, got ${action?.input?.amount ?? action?.input?.targetAmount}`, action);
  }
}

function requireKind(action, expected, label) {
  if (action?.input?.kind !== expected) fail(`${label}: expected kind ${expected}, got ${action?.input?.kind}`, action);
}

function requireAccount(action, expectedPart, label, field = 'account') {
  const account = action?.input?.[field];
  if (!includesAny(account, [expectedPart])) fail(`${label}: expected ${field} to include ${expectedPart}, got ${account}`, action);
}

function requireClarification(payload, fields, label) {
  const clarification = payload?.meta?.clarification || payload?.parsed?.clarification;
  const expectedFields = Array.isArray(fields) ? fields : [fields];
  if (!clarification) fail(`${label}: expected clarification`, payload);
  if (!expectedFields.includes(clarification.field)) {
    fail(`${label}: expected clarification field ${expectedFields.join(' or ')}, got ${clarification.field}`, payload);
  }
}

function requireNotExecuted(payload, label) {
  if (payload?.executed) fail(`${label}: dry-run response executed a real action`, payload);
  if (payload?.meta?.pendingActionId) fail(`${label}: dry-run response created a pending action`, payload);
}

function requireDryRun(payload, label) {
  requireNotExecuted(payload, label);
  if (payload?.meta?.dryRun !== true) fail(`${label}: expected meta.dryRun=true`, payload);
}

function requireTitleIsClean(action, label) {
  const title = text(action?.input?.title);
  if (!title) return;
  const normalized = lower(title);
  if (/\d/.test(title)) fail(`${label}: title contains amount/digits`, action);
  if (normalized.includes('потратил') || normalized.includes('руб') || normalized.includes(':')) {
    fail(`${label}: title looks like copied command`, action);
  }
  if (normalized.includes('напит') && normalized.includes('сигар')) {
    fail(`${label}: title copied mixed purchase composition`, action);
  }
}

async function listAccounts(context) {
  const response = await requestJson(context, '/accounts');
  return unwrapArray(response.payload, 'accounts');
}

async function ensureAccount(context, name, type, balance) {
  const accounts = await listAccounts(context);
  const existing = accounts.find((account) => lower(account.name) === lower(name));
  if (existing) return { account: existing, created: false };

  const response = await requestJson(context, '/accounts', {
    method: 'POST',
    expected: [201],
    body: {
      name,
      type,
      currency: MONEY,
      balance,
      showInTotalBalance: true,
    },
  });

  const account = response.payload?.account;
  if (!account?.id) fail(`Cannot create account ${name}`, response.payload);
  return { account, created: true };
}

async function createBaselineTransaction(context, accountId) {
  const response = await requestJson(context, '/transactions', {
    method: 'POST',
    expected: [201],
    body: {
      accountId,
      type: 'expense',
      amount: 111,
      title: 'Тестовая операция',
      description: 'Опорная операция для AI smoke',
    },
  });

  const transaction = response.payload?.transaction;
  if (!transaction?.id) fail('Cannot create baseline transaction', response.payload);
  return transaction;
}

async function cleanup(context, state) {
  if (state.baselineTransactionId) {
    try {
      await requestJson(context, `/transactions/${state.baselineTransactionId}`, {
        method: 'DELETE',
        body: { balanceMode: 'revert' },
      });
    } catch (error) {
      context.log('cleanup transaction failed', error?.message ?? String(error));
    }
  }

  for (const item of state.createdAccounts.reverse()) {
    try {
      await requestJson(context, `/accounts/${item.id}`, { method: 'DELETE' });
    } catch (error) {
      context.log(`cleanup account failed: ${item.name}`, error?.message ?? String(error));
    }
  }
}

async function runCommand(context, command, label) {
  const response = await requestJson(context, '/ai/parse', {
    method: 'POST',
    body: {
      command,
      execute: false,
      source: 'text',
      idempotencyKey: `ai-finance-command-${context.suffix}-${label}`,
    },
  });

  const payload = response.payload;
  requireDryRun(payload, label);
  context.log(`${label}: ${command}`, {
    intent: payload.intent,
    requiresConfirmation: payload.requiresConfirmation,
    actionTools: actionList(payload).map((action) => action.tool),
    message: payload.message,
  });
  return payload;
}

const tests = [
  {
    label: 'mixed-azs-purchase',
    command: () => 'Потратил 387 рублей на заправке, напиток и сигареты',
    assert(payload) {
      const action = requireSingleAction(payload, this.label);
      requireTool(action, 'create_transaction', this.label);
      requireKind(action, 'expense', this.label);
      requireAmount(action, 387, this.label);
      requireTitleIsClean(action, this.label);

      const input = action.input ?? {};
      const merchantText = [input.merchant, input.place, input.description, ...(Array.isArray(input.tags) ? input.tags : [])].join(' ');
      const itemsText = [input.description, ...(Array.isArray(input.items) ? input.items : []), ...(Array.isArray(input.tags) ? input.tags : [])].join(' ');
      if (!includesAny(merchantText, ['заправ', 'азс'])) fail(`${this.label}: merchant/place is missing`, action);
      if (!includesAny(itemsText, ['напит']) || !includesAny(itemsText, ['сигар'])) fail(`${this.label}: mixed purchase items are missing`, action);
      if (lower(input.category) === 'продукты' || lower(input.section) === 'продукты') fail(`${this.label}: mixed AZS purchase was put into Продукты`, action);
    },
  },
  {
    label: 'terse-cash-snack-expense',
    command: () => 'Расход налик 100 энергетик хотдог 222',
    assert(payload) {
      const action = requireSingleAction(payload, this.label);
      requireTool(action, 'create_transaction', this.label);
      requireKind(action, 'expense', this.label);
      requireAmount(action, 322, this.label);
      requireAccount(action, 'налич', this.label);
      requireTitleIsClean(action, this.label);

      const input = action.input ?? {};
      const itemsText = [input.title, input.description, ...(Array.isArray(input.items) ? input.items : [])].join(' ');
      if (!includesAny(itemsText, ['энергет', 'хотдог', 'хот-дог'])) fail(`${this.label}: snack items are missing`, action);
      if (lower(input.category) === 'продукты') fail(`${this.label}: snack purchase was put into Продукты`, action);
    },
  },
  {
    label: 'groceries-expense',
    command: () => 'Потратил 1200 на продукты',
    assert(payload) {
      const action = requireSingleAction(payload, this.label);
      requireTool(action, 'create_transaction', this.label);
      requireKind(action, 'expense', this.label);
      requireAmount(action, 1200, this.label);
      requireTitleIsClean(action, this.label);
    },
  },
  {
    label: 'coffee-missing-amount',
    command: () => 'Купил кофе',
    assert(payload) {
      requireClarification(payload, 'amount', this.label);
      const action = firstAction(payload);
      requireTool(action, 'create_transaction', this.label);
      requireKind(action, 'expense', this.label);
    },
  },
  {
    label: 'coffee-cash-expense',
    command: () => 'Купил кофе за 250 с налички',
    assert(payload) {
      const action = requireSingleAction(payload, this.label);
      requireTool(action, 'create_transaction', this.label);
      requireKind(action, 'expense', this.label);
      requireAmount(action, 250, this.label);
      requireAccount(action, 'налич', this.label);
      requireTitleIsClean(action, this.label);
    },
  },
  {
    label: 'cash-income-20k',
    command: () => 'Доход 20000 на наличку',
    assert(payload) {
      const action = requireSingleAction(payload, this.label);
      requireTool(action, 'create_transaction', this.label);
      requireKind(action, 'income', this.label);
      requireAmount(action, 20000, this.label);
      requireAccount(action, 'налич', this.label);
      requireTitleIsClean(action, this.label);
    },
  },
  {
    label: 'salary-card-income',
    command: () => 'Получил зарплату 85000 на карту',
    assert(payload) {
      const action = requireSingleAction(payload, this.label);
      requireTool(action, 'create_transaction', this.label);
      requireKind(action, 'income', this.label);
      requireAmount(action, 85000, this.label);
      requireAccount(action, 'карт', this.label);
      requireTitleIsClean(action, this.label);
    },
  },
  {
    label: 'cash-to-card-transfer',
    command: () => 'Переведи 1000 с налички на карту',
    assert(payload) {
      const action = requireSingleAction(payload, this.label);
      requireTool(action, 'transfer_money', this.label);
      requireAmount(action, 1000, this.label);
      requireAccount(action, 'налич', this.label, 'fromAccount');
      requireAccount(action, 'карт', this.label, 'toAccount');
    },
  },
  {
    label: 'goal-with-amount',
    command: () => 'Создай цель отпуск 120000',
    assert(payload) {
      const action = requireSingleAction(payload, this.label);
      requireTool(action, 'create_goal', this.label);
      requireAmount(action, 120000, this.label);
      if (!includesAny(action.input?.title || action.input?.name, ['отпуск'])) fail(`${this.label}: goal title must include отпуск`, action);
    },
  },
  {
    label: 'goal-missing-amount',
    command: () => 'Создай цель на отпуск',
    assert(payload) {
      requireClarification(payload, ['targetAmount', 'amount'], this.label);
      const action = firstAction(payload);
      requireTool(action, 'create_goal', this.label);
    },
  },
  {
    label: 'month-expenses-query',
    command: () => 'Покажи расходы за месяц',
    assert(payload) {
      const action = requireSingleAction(payload, this.label);
      requireTool(action, ['query_analytics', 'show_transactions'], this.label);
    },
  },
  {
    label: 'month-income-query',
    command: () => 'Покажи доходы за месяц',
    assert(payload) {
      const action = requireSingleAction(payload, this.label);
      requireTool(action, ['query_analytics', 'show_transactions'], this.label);
    },
  },
  {
    label: 'show-taxonomy',
    command: () => 'Покажи категории',
    assert(payload) {
      const action = requireSingleAction(payload, this.label);
      requireTool(action, 'show_taxonomy', this.label);
    },
  },
  {
    label: 'update-last-expense-amount',
    command: () => 'Исправь последний расход на 500 рублей',
    assert(payload) {
      const action = requireSingleAction(payload, this.label);
      requireTool(action, 'update_transaction', this.label);
      requireAmount(action, 500, this.label);
    },
  },
  {
    label: 'rename-last-operation',
    command: () => 'Переименуй последнюю операцию в кофе',
    assert(payload) {
      const action = requireSingleAction(payload, this.label);
      requireTool(action, 'update_transaction', this.label);
      const textFields = [action.input?.title, action.input?.description, action.input?.name].join(' ');
      if (!includesAny(textFields, ['кофе'])) fail(`${this.label}: new name/description must include кофе`, action);
    },
  },
];

await runSmoke('ai-finance-command-contracts', async (context) => {
  if (process.env.SKIP_AI_SMOKE === '1') {
    context.log('skipped by SKIP_AI_SMOKE=1');
    return;
  }

  const state = { createdAccounts: [], baselineTransactionId: null };

  try {
    const cash = await ensureAccount(context, 'Наличка', 'cash', 100000);
    const card = await ensureAccount(context, 'Карта', 'card', 100000);
    if (cash.created) state.createdAccounts.push(cash.account);
    if (card.created) state.createdAccounts.push(card.account);

    const baseline = await createBaselineTransaction(context, cash.account.id);
    state.baselineTransactionId = baseline.id;

    for (const test of tests) {
      const payload = await runCommand(context, test.command({ cash: cash.account, card: card.account }), test.label);
      test.assert(payload);
    }

    context.log('AI finance command contracts passed', {
      tested: tests.length,
      cashAccount: cash.account.name,
      cardAccount: card.account.name,
    });
  } finally {
    await cleanup(context, state);
  }
});

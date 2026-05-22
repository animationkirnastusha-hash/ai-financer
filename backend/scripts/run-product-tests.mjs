#!/usr/bin/env node
/*
  AI-Financer product smoke/e2e test runner.

  Purpose:
  - black-box checks of the running backend API;
  - manual CRUD coverage for core entities;
  - AI command coverage through the real AI pipeline, without local parsers;
  - readable report for pre-release checks.

  Run:
    npm run test:product

  Common env:
    TEST_BASE_URL=http://127.0.0.1:3000/api
    TEST_AUTH_TOKEN=<jwt>                 # required on production-like backend
    TEST_AI=1                             # default: 1
    TEST_ADMIN=0                          # set 1 if token belongs to admin
    TEST_DESTRUCTIVE=0                    # set 1 to run high-risk AI delete-all scenario
    TEST_KEEP_DATA=0                      # set 1 to skip cleanup
*/

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

const args = new Set(process.argv.slice(2));
const startedAt = new Date();
const stamp = startedAt.toISOString().replace(/[:.]/g, '-');
const reportDir = join(process.cwd(), 'test-results');
const reportJsonPath = join(reportDir, `product-smoke-${stamp}.json`);
const reportMdPath = join(reportDir, `product-smoke-${stamp}.md`);

const config = {
  baseUrl: normalizeBaseUrl(process.env.TEST_BASE_URL || 'http://127.0.0.1:3000/api'),
  healthUrl: process.env.TEST_HEALTH_URL || inferHealthUrl(process.env.TEST_BASE_URL || 'http://127.0.0.1:3000/api'),
  token: process.env.TEST_AUTH_TOKEN || '',
  timeoutMs: Number(process.env.TEST_TIMEOUT_MS || 25_000),
  runAI: bool(process.env.TEST_AI, true),
  expectAdmin: bool(process.env.TEST_ADMIN, false),
  allowDestructive: bool(process.env.TEST_DESTRUCTIVE, false),
  keepData: bool(process.env.TEST_KEEP_DATA, false),
  reportOnly: args.has('--report-only'),
};

const state = {
  token: config.token,
  prefix: `Автотест ${Date.now()}`,
  accounts: [],
  transactions: [],
  sections: [],
  categories: [],
  goals: [],
  cleanup: [],
  createdByAI: [],
  results: [],
  warnings: [],
};

function bool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function normalizeBaseUrl(url) {
  return String(url).replace(/\/+$/, '');
}

function inferHealthUrl(baseUrl) {
  const clean = normalizeBaseUrl(baseUrl);
  return clean.endsWith('/api') ? `${clean.slice(0, -4)}/health` : `${clean}/health`;
}

function nowMs() {
  return Math.round(performance.now());
}

function short(value, length = 900) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

function money(value) {
  if (!Number.isFinite(Number(value))) return 0;
  return Math.round(Number(value));
}

function assert(condition, message, details) {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

async function withTimeout(promise, label) {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`${label} timed out after ${config.timeoutMs}ms`)), config.timeoutMs);
  });
  return Promise.race([promise, timeout]);
}

async function rawFetch(url, options = {}) {
  return withTimeout(fetch(url, options), `${options.method || 'GET'} ${url}`);
}

async function api(path, options = {}) {
  const url = path.startsWith('http') ? path : `${config.baseUrl}${path}`;
  const headers = {
    Accept: 'application/json',
    ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await rawFetch(url, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const error = new Error(`${options.method || 'GET'} ${path} failed with ${res.status}`);
    error.status = res.status;
    error.payload = data;
    throw error;
  }

  return { status: res.status, data, headers: Object.fromEntries(res.headers.entries()) };
}

async function maybeApi(path, options = {}) {
  try {
    return await api(path, options);
  } catch (error) {
    return { error };
  }
}

async function test(name, fn, opts = {}) {
  if (opts.skip) {
    state.results.push({ name, status: 'skipped', reason: opts.skip });
    console.log(`↷ ${name} — skipped: ${opts.skip}`);
    return;
  }

  const started = nowMs();
  try {
    const details = await fn();
    const durationMs = nowMs() - started;
    state.results.push({ name, status: 'passed', durationMs, details });
    console.log(`✓ ${name} (${durationMs}ms)`);
  } catch (error) {
    const durationMs = nowMs() - started;
    const details = error.details ?? error.payload ?? error.message;
    state.results.push({ name, status: 'failed', durationMs, error: error.message, details });
    console.log(`✕ ${name} (${durationMs}ms)`);
    console.log(`  ${short(details, 500)}`);
  }
}

function addCleanup(label, fn) {
  state.cleanup.push({ label, fn });
}

function idOf(payload, key) {
  if (!payload) return '';
  if (typeof payload.id === 'string') return payload.id;
  if (key && payload[key] && typeof payload[key].id === 'string') return payload[key].id;
  return '';
}

function listFrom(payload, keys) {
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  if (Array.isArray(payload)) return payload;
  return [];
}

async function ensureAuth() {
  if (state.token) {
    const me = await api('/auth/me');
    assert(Boolean(me.data?.user?.id), 'TEST_AUTH_TOKEN is invalid: /auth/me returned no user', me.data);
    return me.data.user;
  }

  const login = await api('/auth/login', { method: 'POST', body: {} });
  state.token = login.data?.token;
  assert(Boolean(state.token), 'Cannot get token through dev login. Set TEST_AUTH_TOKEN for production-like backend.', login.data);
  return login.data?.user;
}

async function createAccount(name, balance = 10_000, type = 'cash') {
  const res = await api('/accounts', { method: 'POST', body: { name, type, currency: 'RUB', balance } });
  const account = res.data?.account;
  assert(account?.id, 'Account create returned no account.id', res.data);
  state.accounts.push(account.id);
  addCleanup(`account:${name}`, async () => {
    await maybeApi(`/accounts/${account.id}`, { method: 'DELETE' });
  });
  return account;
}

async function createSection(name) {
  const res = await api('/sections', { method: 'POST', body: { name, icon: '•', color: '#88aaff' } });
  const section = res.data?.section ?? res.data;
  assert(section?.id, 'Section create returned no id', res.data);
  state.sections.push(section.id);
  addCleanup(`section:${name}`, async () => {
    await maybeApi(`/sections/${section.id}`, { method: 'DELETE' });
  });
  return section;
}

async function createCategory(name, sectionId, type = 'expense') {
  const res = await api('/categories', { method: 'POST', body: { name, type, sectionId, icon: '•', color: '#88aaff' } });
  const category = res.data?.category ?? res.data;
  assert(category?.id, 'Category create returned no id', res.data);
  state.categories.push(category.id);
  addCleanup(`category:${name}`, async () => {
    await maybeApi(`/categories/${category.id}`, { method: 'DELETE' });
  });
  return category;
}

async function createGoal(title) {
  const res = await api('/goals', { method: 'POST', body: { title, targetAmount: 50_000, currentAmount: 1_000, currency: 'RUB' } });
  const goal = res.data?.goal;
  assert(goal?.id, 'Goal create returned no goal.id', res.data);
  state.goals.push(goal.id);
  addCleanup(`goal:${title}`, async () => {
    await maybeApi(`/goals/${goal.id}`, { method: 'DELETE' });
  });
  return goal;
}

async function createTransaction(body, label) {
  const res = await api('/transactions', { method: 'POST', body });
  const transaction = res.data?.transaction;
  assert(transaction?.id, `${label} transaction returned no transaction.id`, res.data);
  state.transactions.push(transaction.id);
  addCleanup(`transaction:${label}`, async () => {
    await maybeApi(`/transactions/${transaction.id}`, { method: 'DELETE' });
  });
  return transaction;
}

function pendingIdFromAI(result) {
  return result?.pendingActionId
    || result?.pendingAction?.id
    || result?.data?.pendingActionId
    || result?.data?.pendingAction?.id
    || result?.preview?.pendingActionId
    || '';
}

async function ai(command, options = {}) {
  const shouldConfirm = options.confirm !== false;
  const beforePendingIds = shouldConfirm ? await pendingIdsSafe() : new Set();
  const body = { command, execute: options.execute ?? true };
  const res = await api('/ai/parse', {
    method: 'POST',
    headers: { 'x-idempotency-key': `test:${Date.now()}:${Math.random().toString(36).slice(2)}` },
    body,
  });

  let result = res.data;
  const pendingActionId = shouldConfirm
    ? await resolvePendingActionId(result, command, beforePendingIds)
    : pendingIdFromAI(result);

  if (shouldConfirm && pendingActionId) {
    const confirmed = await api('/ai/confirm', {
      method: 'POST',
      headers: { 'x-idempotency-key': `test-confirm:${pendingActionId}:${Date.now()}` },
      body: { pendingActionId },
    });
    result = confirmed.data;
  }

  return result;
}

async function pendingIdsSafe() {
  try {
    const res = await api('/ai/pending-actions');
    return new Set(listFrom(res.data, ['pendingActions', 'items', 'actions']).map((item) => item.id).filter(Boolean));
  } catch {
    return new Set();
  }
}

function pendingSearchText(item) {
  return [
    item?.id,
    item?.message,
    item?.summary,
    item?.previewText,
    item?.status,
    item?.riskLevel,
    item?.parsed?.summary,
    item?.parsed?.intent,
    JSON.stringify(item?.parsed || {}),
  ].filter(Boolean).join(' ').toLowerCase();
}

async function resolvePendingActionId(result, command, beforePendingIds = new Set()) {
  const direct = pendingIdFromAI(result);
  if (direct) return direct;

  if (!result?.requiresConfirmation && result?.executed !== false) return '';

  const res = await maybeApi('/ai/pending-actions');
  if (res.error) return '';

  const pending = listFrom(res.data, ['pendingActions', 'items', 'actions'])
    .filter((item) => item?.id && !beforePendingIds.has(item.id))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  if (!pending.length) return '';

  const commandText = String(command || '').toLowerCase();
  const prefixText = String(state.prefix || '').toLowerCase();
  const matched = pending.find((item) => pendingSearchText(item).includes(prefixText))
    || pending.find((item) => {
      const text = pendingSearchText(item);
      return commandText.split(/\s+/).filter((part) => part.length > 3).some((part) => text.includes(part));
    })
    || pending[0];

  return matched?.id || '';
}

async function findAccountByName(name) {
  const res = await api('/accounts');
  const accounts = listFrom(res.data, ['accounts']);
  return accounts.find((item) => String(item.name || '').toLowerCase() === name.toLowerCase())
    || accounts.find((item) => String(item.name || '').toLowerCase().includes(name.toLowerCase()));
}

async function findGoalByTitle(title) {
  const res = await api('/goals');
  const goals = listFrom(res.data, ['goals']);
  return goals.find((item) => String(item.title || '').toLowerCase().includes(title.toLowerCase()));
}

async function findCategoryByName(name) {
  const res = await api('/categories');
  const categories = listFrom(res.data, ['categories']);
  return categories.find((item) => String(item.name || '').toLowerCase().includes(name.toLowerCase()));
}

async function findSectionByName(name) {
  const res = await api('/sections');
  const sections = listFrom(res.data, ['sections']);
  return sections.find((item) => String(item.name || '').toLowerCase().includes(name.toLowerCase()));
}

async function cleanup() {
  if (config.keepData) {
    state.warnings.push('TEST_KEEP_DATA=1: cleanup skipped');
    return;
  }

  console.log('\nCleanup');
  for (const item of [...state.cleanup].reverse()) {
    try {
      await item.fn();
      console.log(`  ✓ ${item.label}`);
    } catch (error) {
      state.warnings.push(`Cleanup failed: ${item.label}: ${error.message}`);
      console.log(`  ! ${item.label}: ${error.message}`);
    }
  }
}

async function run() {
  console.log('AI-Financer product test runner');
  console.log(`Base URL: ${config.baseUrl}`);
  console.log(`Health URL: ${config.healthUrl}`);
  console.log(`AI tests: ${config.runAI ? 'on' : 'off'}`);
  console.log(`Destructive AI tests: ${config.allowDestructive ? 'on' : 'off'}\n`);

  await test('health endpoint', async () => {
    const res = await rawFetch(config.healthUrl, { headers: { Accept: 'application/json' } });
    assert(res.ok, `Health endpoint returned ${res.status}`);
    return { status: res.status };
  });

  await test('auth: login/me', async () => {
    const user = await ensureAuth();
    return { userId: user?.id, isAdmin: user?.isAdmin };
  });

  await test('read contracts: core endpoints return data', async () => {
    const endpoints = [
      '/accounts',
      '/accounts/summary',
      '/accounts/total-balance',
      '/transactions?limit=5',
      '/transactions/latest',
      '/transactions/stats/monthly',
      '/categories',
      '/sections',
      '/goals',
      '/referral',
      '/progression/me',
      '/companion/state',
      '/premium/capabilities',
      '/ai-settings',
      '/ai-settings/onboarding',
      '/ai/pending-actions',
      '/ai/audit-logs?limit=5',
      '/notifications',
    ];

    const checked = [];
    for (const endpoint of endpoints) {
      const res = await api(endpoint);
      checked.push({ endpoint, status: res.status });
    }
    return { checked };
  });

  let accountA;
  let accountB;
  let sectionA;
  let sectionB;
  let expenseCategory;
  let incomeCategory;
  let goal;

  await test('manual CRUD: accounts', async () => {
    accountA = await createAccount(`${state.prefix} Кошелёк`, 100_000, 'cash');
    accountB = await createAccount(`${state.prefix} Карта`, 25_000, 'card');

    const updated = await api(`/accounts/${accountA.id}`, {
      method: 'PUT',
      body: { name: `${state.prefix} Наличка`, balance: 110_000 },
    });
    assert(updated.data?.account?.name?.includes('Наличка'), 'Account update did not change name', updated.data);

    const list = await api('/accounts');
    const accounts = listFrom(list.data, ['accounts']);
    assert(accounts.some((item) => item.id === accountA.id), 'Created account not found in list');
    return { accountA: accountA.id, accountB: accountB.id };
  });

  await test('manual CRUD: sections and categories', async () => {
    sectionA = await createSection(`${state.prefix} Еда`);
    sectionB = await createSection(`${state.prefix} Транспорт`);

    const sectionUpdate = await api(`/sections/${sectionB.id}`, {
      method: 'PUT',
      body: { name: `${state.prefix} Передвижение`, icon: '•', color: '#aabbff' },
    });
    assert((sectionUpdate.data?.section ?? sectionUpdate.data)?.name?.includes('Передвижение'), 'Section update failed', sectionUpdate.data);

    expenseCategory = await createCategory(`${state.prefix} Кофе`, sectionA.id, 'expense');
    incomeCategory = await createCategory(`${state.prefix} Зарплата`, null, 'income');

    const categoryUpdate = await api(`/categories/${expenseCategory.id}`, {
      method: 'PUT',
      body: { name: `${state.prefix} Кафе`, sectionId: sectionB.id, icon: '•', color: '#aabbff' },
    });
    assert((categoryUpdate.data?.category ?? categoryUpdate.data)?.name?.includes('Кафе'), 'Category update failed', categoryUpdate.data);
    return { sectionA: sectionA.id, sectionB: sectionB.id, expenseCategory: expenseCategory.id, incomeCategory: incomeCategory.id };
  });

  await test('manual CRUD: transactions', async () => {
    const expense = await createTransaction({
      accountId: accountA.id,
      categoryId: expenseCategory.id,
      sectionId: sectionB.id,
      type: 'expense',
      amount: 300,
      description: `${state.prefix} кофе`,
    }, 'expense');

    const income = await createTransaction({
      accountId: accountA.id,
      categoryId: incomeCategory.id,
      type: 'income',
      amount: 10_000,
      description: `${state.prefix} доход`,
    }, 'income');

    const transfer = await createTransaction({
      accountId: accountA.id,
      toAccountId: accountB.id,
      type: 'transfer',
      amount: 1_000,
      description: `${state.prefix} перевод`,
    }, 'transfer');

    const updated = await api(`/transactions/${expense.id}`, {
      method: 'PUT',
      body: { amount: 350, description: `${state.prefix} кофе обновлено` },
    });
    assert(money(updated.data?.transaction?.amount) === 350, 'Transaction update did not change amount', updated.data);

    const stats = await api('/transactions/stats/monthly');
    assert(typeof stats.data === 'object', 'Monthly stats returned invalid payload', stats.data);

    const latest = await api('/transactions/latest');
    assert(latest.status === 200, 'Latest transaction endpoint failed');

    return { expense: expense.id, income: income.id, transfer: transfer.id };
  });

  await test('manual CRUD: goals', async () => {
    goal = await createGoal(`${state.prefix} Отпуск`);
    const updated = await api(`/goals/${goal.id}`, {
      method: 'PATCH',
      body: { currentAmount: 5_000, targetAmount: 60_000, note: 'autotest' },
    });
    assert(money(updated.data?.goal?.currentAmount) === 5_000, 'Goal update did not change currentAmount', updated.data);

    const list = await api('/goals');
    const goals = listFrom(list.data, ['goals']);
    assert(goals.some((item) => item.id === goal.id), 'Created goal not found in list', list.data);
    return { goal: goal.id };
  });

  await test('product analytics event tracking', async () => {
    const res = await api('/analytics/events', {
      method: 'POST',
      body: { event: 'screen_view', data: { screen: 'autotest', source: 'product-test-runner' } },
    });
    assert(res.status === 204, 'Analytics event did not return 204', res);
    return { status: res.status };
  });

  await test('admin endpoints access rule', async () => {
    const overview = await maybeApi('/admin/overview');
    if (overview.error) {
      assert(!config.expectAdmin && [401, 403].includes(overview.error.status), 'Admin overview failed unexpectedly', overview.error.payload ?? overview.error.message);
      return { admin: false, status: overview.error.status };
    }

    assert(config.expectAdmin, 'Admin overview is accessible, but TEST_ADMIN is not enabled. Check token/admin policy.', overview.data);
    const users = await api('/admin/users');
    const events = await api('/admin/events');
    const monitoring = await api('/admin/monitoring');
    return { admin: true, overview: overview.status, users: users.status, events: events.status, monitoring: monitoring.status };
  });

  await test('AI: create account through natural language', async () => {
    const name = `${state.prefix} AI Голосовой кошелёк`;
    const result = await ai(`создай новый счёт с названием ${name} с балансом 1000 рублей`);
    const account = await findAccountByName(name);
    assert(account?.id, 'AI did not create account after preview/confirm flow', { result });
    state.createdByAI.push({ type: 'account', id: account.id, name });
    addCleanup(`ai-account:${name}`, async () => {
      const fresh = await findAccountByName(name);
      if (fresh?.id) await maybeApi(`/accounts/${fresh.id}`, { method: 'DELETE' });
    });
    return { accountId: account.id, result: compactAI(result) };
  }, { skip: config.runAI ? '' : 'TEST_AI=0' });

  await test('AI: rename account and set primary account', async () => {
    const oldName = `${state.prefix} AI Переименование`;
    const newName = `${state.prefix} AI Основной`;
    const seed = await createAccount(oldName, 2_000, 'cash');

    const rename = await ai(`переименуй счёт ${oldName} в ${newName}`);
    const account = await findAccountByName(newName);
    assert(account?.id, 'AI did not rename account after preview/confirm flow', { rename, seed });

    const primary = await ai(`сделай счёт ${newName} основным`);
    const settings = await api('/ai-settings');
    const snapshot = settings.data?.settings ?? settings.data;
    const isPrimary = snapshot?.defaultExpenseAccountId === account.id || snapshot?.defaultIncomeAccountId === account.id;
    assert(isPrimary, 'AI did not set account as default/primary in AI settings', { primary, settings: settings.data, account });

    addCleanup(`ai-account-renamed:${newName}`, async () => {
      const fresh = await findAccountByName(newName);
      if (fresh?.id) await maybeApi(`/accounts/${fresh.id}`, { method: 'DELETE' });
    });
    return { accountId: account.id, result: compactAI(primary) };
  }, { skip: config.runAI ? '' : 'TEST_AI=0' });

  await test('AI: create goal through natural language', async () => {
    const title = `${state.prefix} AI Цель`;
    const result = await ai(`создай цель ${title} 77000`);
    const created = await findGoalByTitle(title);
    assert(created?.id, 'AI did not create goal', { result });
    addCleanup(`ai-goal:${title}`, async () => {
      const fresh = await findGoalByTitle(title);
      if (fresh?.id) await maybeApi(`/goals/${fresh.id}`, { method: 'DELETE' });
    });
    return { goalId: created.id, result: compactAI(result) };
  }, { skip: config.runAI ? '' : 'TEST_AI=0' });

  await test('AI: create section/category and show taxonomy', async () => {
    const sectionName = `${state.prefix} AI Раздел`;
    const categoryName = `${state.prefix} AI Категория`;
    const sectionResult = await ai(`создай раздел ${sectionName}`);
    const categoryResult = await ai(`создай категорию ${categoryName} в разделе ${sectionName}`);
    const section = await findSectionByName(sectionName);
    const category = await findCategoryByName(categoryName);
    assert(section?.id, 'AI did not create section', { sectionResult });
    assert(category?.id, 'AI did not create category', { categoryResult });
    addCleanup(`ai-category:${categoryName}`, async () => {
      const fresh = await findCategoryByName(categoryName);
      if (fresh?.id) await maybeApi(`/categories/${fresh.id}`, { method: 'DELETE' });
    });
    addCleanup(`ai-section:${sectionName}`, async () => {
      const fresh = await findSectionByName(sectionName);
      if (fresh?.id) await maybeApi(`/sections/${fresh.id}`, { method: 'DELETE' });
    });
    const show = await ai('покажи категории и разделы', { execute: true, confirm: false });
    return { sectionId: section.id, categoryId: category.id, show: compactAI(show) };
  }, { skip: config.runAI ? '' : 'TEST_AI=0' });

  await test('AI: finance command creates expense with auto category/section', async () => {
    const primaryName = `${state.prefix} AI Основной`;
    const account = await findAccountByName(primaryName) || accountA;
    const before = await api('/transactions?limit=200');
    const beforeCount = listFrom(before.data, ['transactions']).length;
    const result = await ai(`кофе 321 со счета ${account.name}`);
    const after = await api('/transactions?limit=200');
    const transactions = listFrom(after.data, ['transactions']);
    assert(transactions.length >= beforeCount + 1, 'AI did not create a transaction for expense command', { result, before: before.data, after: after.data });
    const created = transactions.find((item) => Number(item.amount) === 321 && item.type === 'expense');
    if (created?.id) {
      state.transactions.push(created.id);
      addCleanup(`ai-transaction:${created.id}`, async () => maybeApi(`/transactions/${created.id}`, { method: 'DELETE' }));
    }
    return { transactionId: created?.id, result: compactAI(result) };
  }, { skip: config.runAI ? '' : 'TEST_AI=0' });

  await test('AI: off-topic gets answer, no financial action required', async () => {
    const result = await ai('как думаешь, люди вообще меняются?', { execute: true, confirm: false });
    const pendingActionId = pendingIdFromAI(result);
    assert(!pendingActionId, 'Off-topic answer created pending financial action', result);
    assert(Boolean(result?.message || result?.answer || result?.text), 'Off-topic answer has no message', result);
    return compactAI(result);
  }, { skip: config.runAI ? '' : 'TEST_AI=0' });

  await test('AI destructive guard: delete all accounts requires explicit opt-in', async () => {
    if (!config.allowDestructive) {
      state.warnings.push('Skipped destructive AI command. Set TEST_DESTRUCTIVE=1 only on an isolated test user/database.');
      return { skippedByDefault: true };
    }
    const result = await ai('удали все счета', { execute: true, confirm: false });
    const pendingActionId = pendingIdFromAI(result);
    assert(pendingActionId || result?.requiresConfirmation || result?.riskLevel === 'high', 'Delete-all-accounts did not require confirmation', result);
    if (pendingActionId) await api('/ai/cancel', { method: 'POST', body: { pendingActionId } });
    return compactAI(result);
  }, { skip: config.runAI ? '' : 'TEST_AI=0' });

  await cleanup();
  writeReports();

  const failed = state.results.filter((item) => item.status === 'failed');
  const skipped = state.results.filter((item) => item.status === 'skipped');
  console.log('\nSummary');
  console.log(`  Passed: ${state.results.filter((item) => item.status === 'passed').length}`);
  console.log(`  Failed: ${failed.length}`);
  console.log(`  Skipped: ${skipped.length}`);
  console.log(`  Report: ${reportMdPath}`);

  if (state.warnings.length) {
    console.log('\nWarnings');
    for (const warning of state.warnings) console.log(`  - ${warning}`);
  }

  if (failed.length) process.exit(1);
}

function compactAI(result) {
  return {
    success: result?.success,
    intent: result?.intent,
    message: result?.message || result?.answer || result?.text,
    executed: result?.executed,
    requiresConfirmation: result?.requiresConfirmation,
    riskLevel: result?.riskLevel,
    pendingActionId: pendingIdFromAI(result) || undefined,
  };
}

function writeReports() {
  mkdirSync(reportDir, { recursive: true });
  const payload = {
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    config: {
      baseUrl: config.baseUrl,
      healthUrl: config.healthUrl,
      runAI: config.runAI,
      expectAdmin: config.expectAdmin,
      allowDestructive: config.allowDestructive,
      keepData: config.keepData,
    },
    results: state.results,
    warnings: state.warnings,
  };
  writeFileSync(reportJsonPath, JSON.stringify(payload, null, 2), 'utf8');

  const lines = [];
  lines.push('# AI-Financer product smoke report');
  lines.push('');
  lines.push(`Started: ${payload.startedAt}`);
  lines.push(`Finished: ${payload.finishedAt}`);
  lines.push(`Base URL: ${config.baseUrl}`);
  lines.push('');
  lines.push('| Status | Test | Time | Details |');
  lines.push('|---|---|---:|---|');
  for (const item of state.results) {
    const icon = item.status === 'passed' ? 'PASS' : item.status === 'failed' ? 'FAIL' : 'SKIP';
    const details = item.status === 'failed' ? `${item.error}: ${short(item.details, 180)}` : item.reason || short(item.details || '', 180);
    lines.push(`| ${icon} | ${escapeMd(item.name)} | ${item.durationMs ?? ''}ms | ${escapeMd(details)} |`);
  }
  if (state.warnings.length) {
    lines.push('');
    lines.push('## Warnings');
    for (const warning of state.warnings) lines.push(`- ${escapeMd(warning)}`);
  }
  writeFileSync(reportMdPath, lines.join('\n'), 'utf8');
}

function escapeMd(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

run().catch(async (error) => {
  console.error('\nFatal test runner error');
  console.error(error);
  try {
    await cleanup();
    writeReports();
  } finally {
    process.exit(1);
  }
});

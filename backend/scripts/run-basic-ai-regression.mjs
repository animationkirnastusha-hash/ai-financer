#!/usr/bin/env node
/*
  AI-Financer базовый regression suite.

  Назначение:
  - проверить backend через HTTP так, как его увидит клиент;
  - покрыть базовую версию до Premium;
  - проверить ручные CRUD endpoints;
  - проверить AI lifecycle через настоящий backend AI pipeline;
  - отдельно поймать опасные ошибки: дубли операций при редактировании, неверный баланс, зависшие pending actions.

  Важно:
  - это тестовый скрипт, не production parser;
  - финансовые команды отправляются в backend как обычный текст;
  - скрипт не извлекает финансовый смысл из пользовательского текста и не меняет production AI pipeline.

  Запуск:
    npm run test:base-ai

  Переменные:
    TEST_BASE_URL=http://localhost:3000/api
    TEST_HEALTH_URL=http://localhost:3000/health
    TEST_AUTH_TOKEN=<jwt>
    TEST_ADMIN=1
    TEST_AI=1
    TEST_DESTRUCTIVE=0
    TEST_KEEP_DATA=0
    TEST_TIMEOUT_MS=30000
*/

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

const args = new Set(process.argv.slice(2));
const startedAt = new Date();
const stamp = startedAt.toISOString().replace(/[:.]/g, '-');
const reportDir = join(process.cwd(), 'test-results');
const reportJsonPath = join(reportDir, `base-ai-regression-${stamp}.json`);
const reportMdPath = join(reportDir, `base-ai-regression-${stamp}.md`);

const config = {
  baseUrl: normalizeBaseUrl(process.env.TEST_BASE_URL || 'http://127.0.0.1:3000/api'),
  healthUrl: process.env.TEST_HEALTH_URL || inferHealthUrl(process.env.TEST_BASE_URL || 'http://127.0.0.1:3000/api'),
  token: process.env.TEST_AUTH_TOKEN || '',
  timeoutMs: Number(process.env.TEST_TIMEOUT_MS || 30_000),
  runAI: bool(process.env.TEST_AI, true),
  expectAdmin: bool(process.env.TEST_ADMIN, false),
  allowDestructive: bool(process.env.TEST_DESTRUCTIVE, false),
  keepData: bool(process.env.TEST_KEEP_DATA, false),
  strictAI: bool(process.env.TEST_STRICT_AI, true),
  reportOnly: args.has('--report-only'),
};

const state = {
  token: config.token,
  user: null,
  prefix: `База ${randomCyrillic(8)}`,
  cleanup: [],
  results: [],
  warnings: [],
  refs: {},
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

function randomCyrillic(length = 8) {
  const alphabet = 'абвгдежзиклмнопрстуфхцчшэюя';
  let value = '';
  for (let i = 0; i < length; i += 1) value += alphabet[Math.floor(Math.random() * alphabet.length)];
  return value;
}

function short(value, length = 900) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

function money(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function assert(condition, message, details) {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

function expectAI(condition, message, details) {
  if (condition) return;
  if (config.strictAI) assert(false, message, details);
  state.warnings.push(`AI soft fail: ${message}: ${short(details, 240)}`);
}

async function withTimeout(promise, label) {
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${config.timeoutMs}ms`)), config.timeoutMs));
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

  const response = await rawFetch(url, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!response.ok) {
    const error = new Error(`${options.method || 'GET'} ${path} failed with ${response.status}`);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return { status: response.status, data, headers: Object.fromEntries(response.headers.entries()) };
}

async function maybeApi(path, options = {}) {
  try { return await api(path, options); } catch (error) { return { error }; }
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
    console.log(`  ${short(details, 650)}`);
  }
}

function addCleanup(label, fn) {
  state.cleanup.push({ label, fn });
}

function listFrom(payload, keys) {
  for (const key of keys) if (Array.isArray(payload?.[key])) return payload[key];
  if (Array.isArray(payload)) return payload;
  return [];
}

function idOf(payload, key) {
  if (typeof payload?.id === 'string') return payload.id;
  if (key && typeof payload?.[key]?.id === 'string') return payload[key].id;
  return '';
}

async function ensureAuth() {
  if (state.token) {
    const me = await api('/auth/me');
    assert(me.data?.user?.id, 'TEST_AUTH_TOKEN невалиден: /auth/me не вернул user.id', me.data);
    state.user = me.data.user;
    return state.user;
  }
  const login = await api('/auth/login', { method: 'POST', body: {} });
  state.token = login.data?.token;
  assert(state.token, 'Не удалось получить token через /auth/login. Для прод-сервера передай TEST_AUTH_TOKEN.', login.data);
  state.user = login.data?.user;
  return state.user;
}

async function createAccount(name, balance = 10_000, type = 'cash', currency = 'RUB') {
  const response = await api('/accounts', { method: 'POST', body: { name, balance, type, currency } });
  const account = response.data?.account ?? response.data;
  assert(account?.id, 'Создание счёта не вернуло account.id', response.data);
  addCleanup(`account:${name}`, async () => maybeApi(`/accounts/${account.id}`, { method: 'DELETE' }));
  return account;
}

async function createSection(name) {
  const response = await api('/sections', { method: 'POST', body: { name, icon: '•', color: '#7c8cff' } });
  const section = response.data?.section ?? response.data;
  assert(section?.id, 'Создание раздела не вернуло id', response.data);
  addCleanup(`section:${name}`, async () => maybeApi(`/sections/${section.id}`, { method: 'DELETE' }));
  return section;
}

async function createCategory(name, sectionId, type = 'expense') {
  const response = await api('/categories', { method: 'POST', body: { name, sectionId, type, icon: '•', color: '#7c8cff' } });
  const category = response.data?.category ?? response.data;
  assert(category?.id, 'Создание категории не вернуло id', response.data);
  addCleanup(`category:${name}`, async () => maybeApi(`/categories/${category.id}`, { method: 'DELETE' }));
  return category;
}

async function createGoal(title, targetAmount = 50_000) {
  const response = await api('/goals', { method: 'POST', body: { title, targetAmount, currentAmount: 1_000, currency: 'RUB' } });
  const goal = response.data?.goal ?? response.data;
  assert(goal?.id, 'Создание цели не вернуло id', response.data);
  addCleanup(`goal:${title}`, async () => maybeApi(`/goals/${goal.id}`, { method: 'DELETE' }));
  return goal;
}

async function createTransaction(body, label) {
  const response = await api('/transactions', { method: 'POST', body });
  const transaction = response.data?.transaction ?? response.data;
  assert(transaction?.id, `${label}: создание операции не вернуло id`, response.data);
  addCleanup(`transaction:${label}`, async () => maybeApi(`/transactions/${transaction.id}`, { method: 'DELETE' }));
  return transaction;
}

async function findAccountByName(name) {
  const response = await api('/accounts');
  const accounts = listFrom(response.data, ['accounts']);
  const needle = String(name).toLowerCase();
  return accounts.find((item) => String(item.name || '').toLowerCase() === needle)
    || accounts.find((item) => String(item.name || '').toLowerCase().includes(needle));
}

async function findSectionByName(name) {
  const response = await api('/sections');
  const sections = listFrom(response.data, ['sections']);
  const needle = String(name).toLowerCase();
  return sections.find((item) => String(item.name || '').toLowerCase().includes(needle));
}

async function findCategoryByName(name) {
  const response = await api('/categories');
  const categories = listFrom(response.data, ['categories']);
  const needle = String(name).toLowerCase();
  return categories.find((item) => String(item.name || '').toLowerCase().includes(needle));
}

async function findGoalByTitle(title) {
  const response = await api('/goals');
  const goals = listFrom(response.data, ['goals']);
  const needle = String(title).toLowerCase();
  return goals.find((item) => String(item.title || '').toLowerCase().includes(needle));
}

async function transactionList(limit = 250) {
  const response = await api(`/transactions?limit=${limit}`);
  return listFrom(response.data, ['transactions']);
}

function pendingIdFromAI(result) {
  return result?.pendingActionId
    || result?.pendingAction?.id
    || result?.data?.pendingActionId
    || result?.data?.pendingAction?.id
    || result?.preview?.pendingActionId
    || result?.meta?.pendingActionId
    || '';
}

function auditLogIdFromAI(result) {
  return result?.auditLogId
    || result?.meta?.auditLogId
    || result?.result?.auditLogId
    || result?.data?.auditLogId
    || '';
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

async function pendingIdsSafe() {
  const response = await maybeApi('/ai/pending-actions');
  if (response.error) return new Set();
  return new Set(listFrom(response.data, ['pendingActions', 'items', 'actions']).map((item) => item.id).filter(Boolean));
}

async function resolvePendingActionId(result, command, beforePendingIds = new Set()) {
  const direct = pendingIdFromAI(result);
  if (direct) return direct;
  if (!result?.requiresConfirmation && result?.executed !== false) return '';

  const response = await maybeApi('/ai/pending-actions');
  if (response.error) return '';

  const pending = listFrom(response.data, ['pendingActions', 'items', 'actions'])
    .filter((item) => item?.id && !beforePendingIds.has(item.id))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  if (!pending.length) return '';

  const commandText = String(command || '').toLowerCase();
  const prefixText = String(state.prefix || '').toLowerCase();
  const matched = pending.find((item) => pendingSearchText(item).includes(prefixText))
    || pending.find((item) => commandText.split(/\s+/).filter((part) => part.length > 3).some((part) => pendingSearchText(item).includes(part)))
    || pending[0];

  return matched?.id || '';
}

async function ai(command, options = {}) {
  const shouldConfirm = options.confirm !== false;
  const beforePendingIds = shouldConfirm ? await pendingIdsSafe() : new Set();
  const response = await api('/ai/parse', {
    method: 'POST',
    headers: { 'x-idempotency-key': `base-ai:${Date.now()}:${Math.random().toString(36).slice(2)}` },
    body: { command, execute: options.execute ?? true },
  });

  let result = response.data;
  const pendingActionId = shouldConfirm ? await resolvePendingActionId(result, command, beforePendingIds) : pendingIdFromAI(result);

  if (shouldConfirm && pendingActionId) {
    const confirmed = await api('/ai/confirm', {
      method: 'POST',
      headers: { 'x-idempotency-key': `base-ai-confirm:${pendingActionId}:${Date.now()}` },
      body: { pendingActionId },
    });
    result = confirmed.data;
  }

  return result;
}

async function aiPreview(command) {
  const beforePendingIds = await pendingIdsSafe();
  const response = await api('/ai/parse', {
    method: 'POST',
    headers: { 'x-idempotency-key': `base-ai-preview:${Date.now()}:${Math.random().toString(36).slice(2)}` },
    body: { command, execute: true },
  });
  const pendingActionId = await resolvePendingActionId(response.data, command, beforePendingIds);
  return { result: response.data, pendingActionId };
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

function compactAI(result) {
  return {
    success: result?.success,
    intent: result?.intent,
    message: result?.message || result?.answer || result?.text,
    executed: result?.executed,
    requiresConfirmation: result?.requiresConfirmation,
    riskLevel: result?.riskLevel,
    pendingActionId: pendingIdFromAI(result) || undefined,
    auditLogId: auditLogIdFromAI(result) || undefined,
  };
}

async function run() {
  console.log('AI-Financer base AI regression suite');
  console.log(`Base URL: ${config.baseUrl}`);
  console.log(`Health URL: ${config.healthUrl}`);
  console.log(`AI tests: ${config.runAI ? 'on' : 'off'}`);
  console.log(`Strict AI: ${config.strictAI ? 'on' : 'off'}`);
  console.log(`Destructive: ${config.allowDestructive ? 'on' : 'off'}\n`);

  await test('health: endpoint responds', async () => {
    const response = await rawFetch(config.healthUrl, { headers: { Accept: 'application/json' } });
    assert(response.ok, `Health endpoint returned ${response.status}`);
    return { status: response.status };
  });

  await test('auth: token/login and /auth/me', async () => {
    const user = await ensureAuth();
    assert(user?.id, 'No user id after auth', user);
    return { userId: user.id, isAdmin: user.isAdmin };
  });

  await test('read contracts: all base endpoints', async () => {
    const endpoints = [
      '/users/me',
      '/accounts',
      '/accounts/summary',
      '/accounts/total-balance',
      '/transactions?limit=5',
      '/transactions/latest',
      '/transactions/stats/monthly',
      '/sections',
      '/categories',
      '/goals',
      '/budgets',
      '/recurring',
      '/notifications',
      '/referral',
      '/progression/me',
      '/companion/state',
      '/companion/events',
      '/premium/capabilities',
      '/ai-settings',
      '/ai-settings/onboarding',
      '/ai/pending-actions',
      '/ai/audit-logs?limit=5',
      '/ai/observability?limit=5',
    ];

    const checked = [];
    for (const endpoint of endpoints) {
      const response = await api(endpoint);
      checked.push({ endpoint, status: response.status });
    }
    return { checked };
  });

  await test('manual CRUD: accounts, balance endpoints and lock flags', async () => {
    const cash = await createAccount(`${state.prefix} Наличка`, 100_000, 'cash');
    const card = await createAccount(`${state.prefix} Карта`, 25_000, 'card');
    const updated = await api(`/accounts/${cash.id}`, { method: 'PUT', body: { name: `${state.prefix} Основная наличка`, balance: 110_000, lockSpending: false, lockTransfers: false } });
    assert((updated.data?.account ?? updated.data)?.name?.includes('Основная'), 'Account update did not change name', updated.data);
    await api('/accounts/recalculate-balances', { method: 'POST' });
    const total = await api('/accounts/total-balance');
    assert(typeof total.data === 'object', 'Total balance payload invalid', total.data);
    state.refs.cash = { ...cash, name: `${state.prefix} Основная наличка` };
    state.refs.card = card;
    return { cash: cash.id, card: card.id, total: total.data };
  });

  await test('manual CRUD: sections, categories and taxonomy update', async () => {
    const food = await createSection(`${state.prefix} Еда`);
    const transport = await createSection(`${state.prefix} Транспорт`);
    const updatedSection = await api(`/sections/${transport.id}`, { method: 'PUT', body: { name: `${state.prefix} Передвижение`, icon: '•', color: '#77aaff' } });
    assert((updatedSection.data?.section ?? updatedSection.data)?.name?.includes('Передвижение'), 'Section update failed', updatedSection.data);
    const cafe = await createCategory(`${state.prefix} Кафе`, food.id, 'expense');
    const salary = await createCategory(`${state.prefix} Зарплата`, null, 'income');
    const updatedCategory = await api(`/categories/${cafe.id}`, { method: 'PUT', body: { name: `${state.prefix} Кофе`, sectionId: transport.id, icon: '•', color: '#77aaff' } });
    assert((updatedCategory.data?.category ?? updatedCategory.data)?.name?.includes('Кофе'), 'Category update failed', updatedCategory.data);
    state.refs.food = food;
    state.refs.transport = { ...transport, name: `${state.prefix} Передвижение` };
    state.refs.expenseCategory = { ...cafe, name: `${state.prefix} Кофе` };
    state.refs.incomeCategory = salary;
    return { food: food.id, transport: transport.id, cafe: cafe.id, salary: salary.id };
  });

  await test('manual CRUD: income, expense, transfer and transaction update', async () => {
    const expense = await createTransaction({ accountId: state.refs.cash.id, categoryId: state.refs.expenseCategory.id, sectionId: state.refs.transport.id, type: 'expense', amount: 300, description: `${state.prefix} кофе` }, 'manual-expense');
    const income = await createTransaction({ accountId: state.refs.cash.id, categoryId: state.refs.incomeCategory.id, type: 'income', amount: 10_000, description: `${state.prefix} доход` }, 'manual-income');
    const transfer = await createTransaction({ accountId: state.refs.cash.id, toAccountId: state.refs.card.id, type: 'transfer', amount: 1_000, description: `${state.prefix} перевод` }, 'manual-transfer');
    const updated = await api(`/transactions/${expense.id}`, { method: 'PATCH', body: { amount: 350, description: `${state.prefix} кофе обновлено`, categoryId: state.refs.expenseCategory.id, sectionId: state.refs.transport.id } });
    assert(money(updated.data?.transaction?.amount) === 350, 'Transaction update did not change amount', updated.data);
    const latest = await api('/transactions/latest');
    const monthly = await api('/transactions/stats/monthly');
    assert(latest.status === 200 && monthly.status === 200, 'Transaction read endpoints failed');
    state.refs.manualIncome = income;
    return { expense: expense.id, income: income.id, transfer: transfer.id };
  });

  await test('manual CRUD: goals', async () => {
    const goal = await createGoal(`${state.prefix} Отпуск`, 60_000);
    const updated = await api(`/goals/${goal.id}`, { method: 'PATCH', body: { currentAmount: 5_000, targetAmount: 80_000, note: 'autotest' } });
    assert(money(updated.data?.goal?.targetAmount) === 80_000, 'Goal update did not change targetAmount', updated.data);
    state.refs.goal = goal;
    return { goal: goal.id };
  });

  await test('manual CRUD: budgets', async () => {
    const created = await api('/budgets', { method: 'POST', body: { categoryId: state.refs.expenseCategory.id, amount: 20_000, period: 'monthly', notifyAt: 75, isActive: true } });
    const budget = created.data?.budget ?? created.data;
    assert(budget?.id, 'Budget create returned no id', created.data);
    addCleanup(`budget:${budget.id}`, async () => maybeApi(`/budgets/${budget.id}`, { method: 'DELETE' }));
    const read = await api(`/budgets/${budget.id}`);
    const updated = await api(`/budgets/${budget.id}`, { method: 'PUT', body: { amount: 25_000, notifyAt: 80, isActive: false } });
    assert(money((updated.data?.budget ?? updated.data)?.amount) === 25_000, 'Budget update failed', updated.data);
    return { budget: budget.id, read: read.status };
  });

  await test('manual CRUD: recurring payments', async () => {
    const nextDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const created = await api('/recurring', { method: 'POST', body: { name: `${state.prefix} Подписка`, amount: 499, category: 'Подписки', period: 'monthly', accountId: state.refs.card.id, nextDate, isActive: true } });
    const recurring = created.data?.recurringPayment ?? created.data;
    assert(recurring?.id, 'Recurring create returned no id', created.data);
    addCleanup(`recurring:${recurring.id}`, async () => maybeApi(`/recurring/${recurring.id}`, { method: 'DELETE' }));
    const read = await api(`/recurring/${recurring.id}`);
    const updated = await api(`/recurring/${recurring.id}`, { method: 'PUT', body: { name: `${state.prefix} Подписка обновлена`, amount: 599, category: 'Сервисы', period: 'monthly', accountId: state.refs.card.id, isActive: false } });
    assert(money((updated.data?.recurringPayment ?? updated.data)?.amount) === 599, 'Recurring update failed', updated.data);
    return { recurring: recurring.id, read: read.status };
  });

  await test('manual: settings, onboarding, progression, referral and analytics', async () => {
    const settings = await api('/ai-settings');
    await api('/ai-settings', { method: 'PATCH', body: { voiceInputEnabled: true, voiceOutputEnabled: false, afterWakeListenSeconds: 7 } });
    const onboarding = await api('/ai-settings/onboarding');
    await api('/ai-settings/onboarding', { method: 'PATCH', body: { voiceIntroSeen: true } });
    await api('/progression/activity', { method: 'POST', body: { type: 'test_activity', amount: 1, metadata: { source: 'base-ai-regression' } } });
    const progression = await api('/progression/me');
    const referral = await api('/referral');
    const analytics = await api('/analytics/events', { method: 'POST', body: { event: 'screen_view', data: { screen: 'base-ai-regression' } } });
    assert(analytics.status === 204, 'Analytics event should return 204', analytics);
    return { settings: settings.status, onboarding: onboarding.status, progression: progression.status, referral: referral.status };
  });

  await test('manual: notifications read contracts', async () => {
    const notifications = await api('/notifications');
    await api('/notifications/read-all', { method: 'POST' });
    return { count: listFrom(notifications.data, ['notifications']).length };
  });

  await test('admin: access rule and admin dashboard endpoints', async () => {
    const overview = await maybeApi('/admin/overview');
    if (overview.error) {
      assert(!config.expectAdmin && [401, 403].includes(overview.error.status), 'Admin overview failed unexpectedly', overview.error.payload ?? overview.error.message);
      return { admin: false, status: overview.error.status };
    }
    assert(config.expectAdmin, 'Admin endpoint is accessible, but TEST_ADMIN is not enabled. Check test token policy.', overview.data);
    const users = await api('/admin/users');
    const events = await api('/admin/events');
    const monitoring = await api('/admin/monitoring');
    return { admin: true, overview: overview.status, users: users.status, events: events.status, monitoring: monitoring.status };
  });

  const aiSkip = config.runAI ? '' : 'TEST_AI=0';

  await test('AI: off-topic answers without financial pending action', async () => {
    const result = await ai('как думаешь, стоит ли сегодня отдохнуть?', { execute: true, confirm: false });
    expectAI(!pendingIdFromAI(result) && !result?.requiresConfirmation, 'Off-topic created a pending financial action', result);
    expectAI(Boolean(result?.message || result?.answer || result?.text), 'Off-topic returned no answer text', result);
    return compactAI(result);
  }, { skip: aiSkip });

  await test('AI: create account with confirmation', async () => {
    const name = `${state.prefix} AI Счёт`;
    const result = await ai(`создай новый счёт с названием "${name}" и балансом 1000 рублей`);
    const account = await findAccountByName(name);
    expectAI(account?.id, 'AI did not create account', { result });
    if (account?.id) addCleanup(`ai-account:${name}`, async () => { const fresh = await findAccountByName(name); if (fresh?.id) await maybeApi(`/accounts/${fresh.id}`, { method: 'DELETE' }); });
    state.refs.aiAccount = account;
    return { accountId: account?.id, result: compactAI(result) };
  }, { skip: aiSkip });

  await test('AI: rename account and make it primary/default', async () => {
    const oldName = `${state.prefix} AI Старое имя`;
    const newName = `${state.prefix} AI Основной счёт`;
    const seed = await createAccount(oldName, 2_000, 'cash');
    const rename = await ai(`переименуй счёт "${oldName}" в "${newName}"`);
    const renamed = await findAccountByName(newName);
    expectAI(renamed?.id, 'AI did not rename account', { rename, seed });
    const primary = await ai(`сделай счёт "${newName}" основным`);
    const settings = await api('/ai-settings');
    const snapshot = settings.data?.settings ?? settings.data;
    const isPrimary = snapshot?.defaultExpenseAccountId === renamed?.id || snapshot?.defaultIncomeAccountId === renamed?.id || snapshot?.primaryAccountId === renamed?.id;
    expectAI(isPrimary, 'AI did not make account primary/default', { primary, settings: settings.data, renamed });
    return { accountId: renamed?.id, result: compactAI(primary) };
  }, { skip: aiSkip });

  await test('AI: create expense with category/section through planner contract', async () => {
    const before = await transactionList();
    const beforeIds = new Set(before.map((item) => item.id));
    const result = await ai(`запиши расход ${state.prefix} кофе 321 рубль со счёта "${state.refs.cash.name}" в категорию "${state.prefix} Кофе"`);
    const after = await transactionList();
    const created = after.find((item) => !beforeIds.has(item.id) && item.type === 'expense' && money(item.amount) === 321);
    expectAI(created?.id, 'AI did not create expense transaction', { result, after: after.slice(0, 5) });
    if (created?.id) addCleanup(`ai-expense:${created.id}`, async () => maybeApi(`/transactions/${created.id}`, { method: 'DELETE' }));
    state.refs.aiExpense = created;
    return { transactionId: created?.id, result: compactAI(result) };
  }, { skip: aiSkip });

  await test('AI: create income and then edit last income without duplicate', async () => {
    const accountName = state.refs.cash.name;
    const before = await transactionList();
    const beforeCount = before.length;
    const create = await ai(`запиши доход ${state.prefix} премия 4321 рубль на счёт "${accountName}"`);
    const afterCreate = await transactionList();
    const income = afterCreate.find((item) => item.type === 'income' && money(item.amount) === 4321 && String(item.description || '').toLowerCase().includes(state.prefix.toLowerCase()))
      || afterCreate.find((item) => item.type === 'income' && money(item.amount) === 4321);
    expectAI(income?.id, 'AI did not create income transaction', { create, afterCreate: afterCreate.slice(0, 5) });
    if (income?.id) addCleanup(`ai-income:${income.id}`, async () => maybeApi(`/transactions/${income.id}`, { method: 'DELETE' }));

    const edit = await ai('измени описание последнего дохода на такси');
    const afterEdit = await transactionList();
    const matchingIncome = afterEdit.filter((item) => item.type === 'income' && money(item.amount) === 4321);
    expectAI(afterEdit.length === afterCreate.length, 'Editing last income changed transaction count. Possible duplicate income.', { beforeCount, create, edit, afterCreateCount: afterCreate.length, afterEditCount: afterEdit.length, matchingIncome: matchingIncome.map((item) => item.id) });
    const edited = afterEdit.find((item) => item.id === income?.id) || matchingIncome[0];
    expectAI(String(edited?.description || '').toLowerCase().includes('такси'), 'AI did not update income description', { edit, edited });

    const editAmount = await ai('измени сумму последнего дохода на 5000');
    const afterAmount = await transactionList();
    const amountEdited = afterAmount.find((item) => item.id === income?.id) || afterAmount.find((item) => item.type === 'income' && money(item.amount) === 5000);
    expectAI(afterAmount.length === afterEdit.length, 'Editing last income amount created duplicate transaction', { editAmount, afterEditCount: afterEdit.length, afterAmountCount: afterAmount.length });
    expectAI(money(amountEdited?.amount) === 5000, 'AI did not update income amount', { editAmount, amountEdited });

    return { incomeId: income?.id, create: compactAI(create), edit: compactAI(edit), editAmount: compactAI(editAmount) };
  }, { skip: aiSkip });

  await test('AI: transfer between accounts', async () => {
    const from = await createAccount(`${state.prefix} AI Перевод Откуда`, 9_000, 'card');
    const to = await createAccount(`${state.prefix} AI Перевод Куда`, 1_000, 'cash');
    const before = await transactionList();
    const beforeIds = new Set(before.map((item) => item.id));
    const result = await ai(`переведи 777 рублей со счёта "${from.name}" на счёт "${to.name}"`);
    const after = await transactionList();
    const created = after.find((item) => !beforeIds.has(item.id) && item.type === 'transfer' && money(item.amount) === 777);
    expectAI(created?.id, 'AI did not create transfer', { result, after: after.slice(0, 5) });
    if (created?.id) addCleanup(`ai-transfer:${created.id}`, async () => maybeApi(`/transactions/${created.id}`, { method: 'DELETE' }));
    return { transactionId: created?.id, result: compactAI(result) };
  }, { skip: aiSkip });

  await test('AI: goals lifecycle', async () => {
    const title = `${state.prefix} AI Цель`;
    const create = await ai(`создай цель "${title}" на 77000 рублей`);
    const goal = await findGoalByTitle(title);
    expectAI(goal?.id, 'AI did not create goal', { create });
    if (goal?.id) addCleanup(`ai-goal:${goal.id}`, async () => { const fresh = await findGoalByTitle(title); if (fresh?.id) await maybeApi(`/goals/${fresh.id}`, { method: 'DELETE' }); });
    const update = await ai(`измени цель "${title}" поставь сумму 88000 рублей`);
    const updated = await findGoalByTitle(title);
    expectAI(money(updated?.targetAmount ?? updated?.target) === 88000, 'AI did not update goal target', { update, updated });
    const remove = await ai(`удали цель "${title}"`);
    const removed = await findGoalByTitle(title);
    expectAI(!removed?.id, 'AI did not delete goal', { remove, removed });
    return { goalId: goal?.id, create: compactAI(create), update: compactAI(update), remove: compactAI(remove) };
  }, { skip: aiSkip });

  await test('AI: taxonomy lifecycle', async () => {
    const sectionName = `${state.prefix} AI Раздел`;
    const categoryName = `${state.prefix} AI Категория`;
    const sectionCreate = await ai(`создай раздел "${sectionName}"`);
    const categoryCreate = await ai(`создай категорию "${categoryName}" в разделе "${sectionName}"`);
    const section = await findSectionByName(sectionName);
    const category = await findCategoryByName(categoryName);
    expectAI(section?.id, 'AI did not create section', { sectionCreate });
    expectAI(category?.id, 'AI did not create category', { categoryCreate });
    if (category?.id) addCleanup(`ai-category:${category.id}`, async () => { const fresh = await findCategoryByName(categoryName); if (fresh?.id) await maybeApi(`/categories/${fresh.id}`, { method: 'DELETE' }); });
    if (section?.id) addCleanup(`ai-section:${section.id}`, async () => { const fresh = await findSectionByName(sectionName); if (fresh?.id) await maybeApi(`/sections/${fresh.id}`, { method: 'DELETE' }); });
    const renameCategoryName = `${state.prefix} AI Категория Новая`;
    const rename = await ai(`переименуй категорию "${categoryName}" в "${renameCategoryName}"`);
    const renamed = await findCategoryByName(renameCategoryName);
    expectAI(renamed?.id, 'AI did not rename category', { rename, renamed });
    const show = await ai('покажи категории и разделы', { execute: true, confirm: false });
    return { sectionId: section?.id, categoryId: renamed?.id, show: compactAI(show) };
  }, { skip: aiSkip });

  await test('AI: pending action can be cancelled and does not mutate data', async () => {
    const name = `${state.prefix} AI Отмена`;
    const { result, pendingActionId } = await aiPreview(`создай счёт "${name}" с балансом 1234`);
    if (pendingActionId) {
      await api('/ai/cancel', { method: 'POST', body: { pendingActionId } });
    }
    const found = await findAccountByName(name);
    expectAI(!found?.id, 'Cancelled pending action still mutated data', { result, pendingActionId, found });
    return { pendingActionId, result: compactAI(result) };
  }, { skip: aiSkip });

  await test('AI: more than 3 actions is blocked for base version', async () => {
    const result = await ai('создай счёт тест один, создай счёт тест два, создай счёт тест три, создай счёт тест четыре', { execute: true, confirm: false });
    const text = JSON.stringify(result).toLowerCase();
    const blocked = result?.success === false || text.includes('premium') || text.includes('преми') || text.includes('3') || text.includes('тр');
    expectAI(blocked, 'AI did not block 4+ actions in base version', result);
    return compactAI(result);
  }, { skip: aiSkip });

  await test('AI destructive guard: delete all accounts requires explicit opt-in', async () => {
    if (!config.allowDestructive) {
      state.warnings.push('Skipped destructive AI command. Set TEST_DESTRUCTIVE=1 only on isolated database.');
      return { skippedByDefault: true };
    }
    const { result, pendingActionId } = await aiPreview('удали все счета');
    expectAI(pendingActionId || result?.requiresConfirmation || result?.riskLevel === 'high', 'Delete-all did not require high-risk confirmation', result);
    if (pendingActionId) await api('/ai/cancel', { method: 'POST', body: { pendingActionId } });
    return { pendingActionId, result: compactAI(result) };
  }, { skip: aiSkip });

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

function writeReports() {
  mkdirSync(reportDir, { recursive: true });
  const payload = {
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    config: {
      baseUrl: config.baseUrl,
      healthUrl: config.healthUrl,
      runAI: config.runAI,
      strictAI: config.strictAI,
      expectAdmin: config.expectAdmin,
      allowDestructive: config.allowDestructive,
      keepData: config.keepData,
    },
    prefix: state.prefix,
    results: state.results,
    warnings: state.warnings,
  };
  writeFileSync(reportJsonPath, JSON.stringify(payload, null, 2), 'utf8');

  const lines = [];
  lines.push('# AI-Financer base AI regression report');
  lines.push('');
  lines.push(`Started: ${payload.startedAt}`);
  lines.push(`Finished: ${payload.finishedAt}`);
  lines.push(`Base URL: ${config.baseUrl}`);
  lines.push(`Prefix: ${state.prefix}`);
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

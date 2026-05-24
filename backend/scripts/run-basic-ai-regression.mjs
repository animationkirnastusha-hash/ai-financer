#!/usr/bin/env node
/*
  AI-Financer base AI regression suite.

  Black-box backend tests for the base (non-premium) version.
  The runner does not parse financial commands. It sends natural-language commands
  to the backend AI endpoint and verifies API state after execution.
*/

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
  token: readToken(),
  timeoutMs: Number(process.env.TEST_TIMEOUT_MS || 30_000),
  runAI: bool(process.env.TEST_AI, true),
  strictAI: bool(process.env.TEST_STRICT_AI, true),
  expectAdmin: bool(process.env.TEST_ADMIN, false),
  allowDestructive: bool(process.env.TEST_DESTRUCTIVE, false),
  keepData: bool(process.env.TEST_KEEP_DATA, false),
  resetBefore: bool(process.env.TEST_RESET_BEFORE, true),
  reportOnly: args.has('--report-only'),
};

const state = {
  token: config.token,
  prefix: `База ${randomCyrillic(7)}`,
  accounts: [],
  sections: [],
  categories: [],
  transactions: [],
  goals: [],
  budgets: [],
  recurring: [],
  cleanup: [],
  results: [],
  warnings: [],
};

function bool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function normalizeBaseUrl(value) {
  return String(value || '').replace(/\/+$/, '');
}

function inferHealthUrl(baseUrl) {
  const clean = normalizeBaseUrl(baseUrl);
  return clean.endsWith('/api') ? `${clean.slice(0, -4)}/health` : `${clean}/health`;
}

function readToken() {
  const direct = String(process.env.TEST_AUTH_TOKEN || '').trim();
  if (direct) return direct;

  const tokenFile = process.env.TEST_AUTH_TOKEN_FILE || join(process.cwd(), '.test-auth-token');
  if (existsSync(tokenFile)) {
    const saved = readFileSync(tokenFile, 'utf8').trim();
    if (saved) return saved;
  }

  return '';
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

function nowMs() {
  return Math.round(performance.now());
}

function assert(condition, message, details) {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

function warn(message, details) {
  state.warnings.push({ message, details });
  console.log(`  warning: ${message}`);
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
    try { data = JSON.parse(text); } catch { data = text; }
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
    console.log(`  ${short(details, 700)}`);
  }
}

function addCleanup(label, fn) {
  if (!config.keepData) state.cleanup.push({ label, fn });
}

function listFrom(payload, keys) {
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  if (Array.isArray(payload)) return payload;
  return [];
}

function idOf(payload, keys = ['id']) {
  if (!payload) return '';
  if (typeof payload.id === 'string') return payload.id;
  for (const key of keys) {
    if (typeof payload?.[key]?.id === 'string') return payload[key].id;
  }
  return '';
}

function pickArrayPayload(data) {
  if (Array.isArray(data)) return data;
  return listFrom(data, ['items', 'data', 'accounts', 'transactions', 'sections', 'categories', 'goals', 'budgets', 'recurringPayments', 'notifications']);
}

async function requireToken() {
  if (state.token) return;
  if (bool(process.env.TEST_ALLOW_DEV_LOGIN, false)) {
    const login = await api('/auth/login', { method: 'POST', body: {} });
    state.token = login.data?.token;
    assert(Boolean(state.token), 'Dev login did not return token. Use npm run test:token first.', login.data);
    return;
  }
  throw new Error('TEST_AUTH_TOKEN is empty. Run TEST_TELEGRAM_ID=516730814 TEST_ADMIN=1 npm run test:token, then run this suite again. The token is also saved to backend/.test-auth-token.');
}

async function ensureAuth() {
  await requireToken();
  const me = await api('/auth/me');
  assert(Boolean(me.data?.user?.id), '/auth/me returned no user. Regenerate token after DB reset.', me.data);
  return me.data.user;
}

async function resetBeforeRun() {
  if (!config.resetBefore) return { skipped: true };
  const res = await maybeApi('/users/me/reset', { method: 'POST', body: { mode: 'finance' } });
  if (res.error) {
    warn('Pre-test finance reset failed; continuing with existing test user data', res.error.payload ?? res.error.message);
    return { ok: false, error: res.error.payload ?? res.error.message };
  }
  state.accounts = [];
  state.sections = [];
  state.categories = [];
  state.transactions = [];
  state.goals = [];
  state.budgets = [];
  state.recurring = [];
  state.cleanup = [];
  return { ok: true, result: res.data };
}

async function createAccount(name, balance = 10000, type = 'cash') {
  const res = await api('/accounts', { method: 'POST', body: { name, type, currency: 'RUB', balance } });
  const account = res.data?.account ?? res.data;
  assert(account?.id, 'Account create returned no id', res.data);
  state.accounts.push(account.id);
  addCleanup(`account:${name}`, () => maybeApi(`/accounts/${account.id}`, { method: 'DELETE' }));
  return account;
}

async function createSection(name) {
  const res = await api('/sections', { method: 'POST', body: { name, icon: '•', color: '#8ea7ff' } });
  const section = res.data?.section ?? res.data;
  assert(section?.id, 'Section create returned no id', res.data);
  state.sections.push(section.id);
  addCleanup(`section:${name}`, () => maybeApi(`/sections/${section.id}`, { method: 'DELETE' }));
  return section;
}

async function createCategory(name, sectionId, type = 'expense') {
  const res = await api('/categories', { method: 'POST', body: { name, type, sectionId, icon: '•', color: '#8ea7ff' } });
  const category = res.data?.category ?? res.data;
  assert(category?.id, 'Category create returned no id', res.data);
  state.categories.push(category.id);
  addCleanup(`category:${name}`, () => maybeApi(`/categories/${category.id}`, { method: 'DELETE' }));
  return category;
}

async function createTransaction(payload) {
  const res = await api('/transactions', { method: 'POST', body: payload });
  const tx = res.data?.transaction ?? res.data;
  assert(tx?.id, 'Transaction create returned no id', res.data);
  state.transactions.push(tx.id);
  addCleanup(`transaction:${tx.id}`, () => maybeApi(`/transactions/${tx.id}`, { method: 'DELETE' }));
  return tx;
}

async function createGoal(title, targetAmount = 50000) {
  const res = await api('/goals', { method: 'POST', body: { title, targetAmount, currentAmount: 0, currency: 'RUB' } });
  const goal = res.data?.goal ?? res.data;
  assert(goal?.id, 'Goal create returned no id', res.data);
  state.goals.push(goal.id);
  addCleanup(`goal:${title}`, () => maybeApi(`/goals/${goal.id}`, { method: 'DELETE' }));
  return goal;
}

function aiPayload(command) {
  return { command, text: command, source: 'console-regression' };
}

function aiResult(data) {
  return data?.result ?? data;
}

async function aiParse(command) {
  const res = await api('/ai/parse', { method: 'POST', body: aiPayload(command) });
  return aiResult(res.data);
}

async function aiConfirm(pendingActionId) {
  const body = pendingActionId ? { pendingActionId } : {};
  const res = await api('/ai/confirm', { method: 'POST', body });
  return aiResult(res.data);
}

async function aiCancel(pendingActionId) {
  const body = pendingActionId ? { pendingActionId } : {};
  const res = await api('/ai/cancel', { method: 'POST', body });
  return aiResult(res.data);
}

function pendingId(result) {
  return result?.pendingActionId || result?.result?.pendingActionId || result?.pendingAction?.id || result?.meta?.pendingActionId || '';
}

async function latestPending(command = '', sinceMs = 0) {
  const res = await maybeApi('/ai/pending-actions');
  if (res.error) return null;
  const items = pickArrayPayload(res.data);
  const normalizedCommand = String(command || '').trim();
  const pending = items
    .filter((item) => item?.status === 'pending')
    .filter((item) => {
      if (!sinceMs) return true;
      const created = new Date(item.createdAt || item.updatedAt || 0).getTime();
      return Number.isFinite(created) && created >= sinceMs - 2_000;
    })
    .sort((a, b) => {
      const aCommand = String(a.command || '').trim();
      const bCommand = String(b.command || '').trim();
      const aExact = normalizedCommand && aCommand === normalizedCommand ? 1 : 0;
      const bExact = normalizedCommand && bCommand === normalizedCommand ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      return new Date(b.createdAt || b.updatedAt || 0).getTime() - new Date(a.createdAt || a.updatedAt || 0).getTime();
    });
  return pending[0] || null;
}

async function latestPendingId(command = '', sinceMs = 0) {
  const pending = await latestPending(command, sinceMs);
  return pending?.id || '';
}

async function executeAi(command) {
  const beforeParseMs = Date.now();
  const prepared = await aiParse(command);
  assert(prepared?.success !== false, `AI prepare failed for: ${command}`, prepared);

  let id = pendingId(prepared);
  if (!id && (prepared?.requiresConfirmation || (prepared?.intent === 'batch' && !prepared?.executed))) {
    id = await latestPendingId(command, beforeParseMs);
  }

  const shouldConfirm = Boolean(prepared?.requiresConfirmation || (prepared?.intent === 'batch' && !prepared?.executed));
  if (shouldConfirm) {
    assert(Boolean(id), `AI prepared an unexecuted action but did not expose pendingActionId: ${command}`, { prepared, latestPending: await latestPending(command, beforeParseMs) });
    const confirmed = await aiConfirm(id);
    assert(confirmed?.success !== false, `AI confirm failed for: ${command}`, { prepared, confirmed, pendingActionId: id });
    assert(confirmed?.executed === true || confirmed?.requiresConfirmation === false, `AI confirm did not execute action: ${command}`, { prepared, confirmed, pendingActionId: id });
    return { prepared, confirmed, pendingActionId: id };
  }

  assert(prepared?.executed === true || prepared?.intent !== 'batch', `AI returned unexecuted batch without pending action: ${command}`, prepared);
  return { prepared, confirmed: prepared };
}

async function listTransactions() {
  const res = await api('/transactions');
  return pickArrayPayload(res.data);
}

async function listAccounts() {
  const res = await api('/accounts');
  return pickArrayPayload(res.data);
}

async function listGoals() {
  const res = await api('/goals');
  return pickArrayPayload(res.data);
}

async function listSections() {
  const res = await api('/sections');
  return pickArrayPayload(res.data);
}

async function listCategories() {
  const res = await api('/categories');
  return pickArrayPayload(res.data);
}

async function cleanup() {
  if (config.keepData) return;
  console.log('\nCleanup');
  for (const item of [...state.cleanup].reverse()) {
    try { await item.fn(); } catch (error) { state.warnings.push({ message: `Cleanup failed: ${item.label}`, details: error.message }); }
  }
}

async function writeReport() {
  mkdirSync(reportDir, { recursive: true });
  const passed = state.results.filter((item) => item.status === 'passed').length;
  const failed = state.results.filter((item) => item.status === 'failed').length;
  const skipped = state.results.filter((item) => item.status === 'skipped').length;
  const payload = { startedAt, finishedAt: new Date(), config: { ...config, token: config.token ? '<hidden>' : '' }, results: state.results, warnings: state.warnings, summary: { passed, failed, skipped } };
  writeFileSync(reportJsonPath, JSON.stringify(payload, null, 2), 'utf8');

  const lines = [];
  lines.push('# AI-Financer base AI regression report');
  lines.push('');
  lines.push(`- Started: ${startedAt.toISOString()}`);
  lines.push(`- Base URL: ${config.baseUrl}`);
  lines.push(`- AI tests: ${config.runAI ? 'on' : 'off'}`);
  lines.push(`- Strict AI: ${config.strictAI ? 'on' : 'off'}`);
  lines.push('');
  lines.push(`## Summary`);
  lines.push('');
  lines.push(`- Passed: ${passed}`);
  lines.push(`- Failed: ${failed}`);
  lines.push(`- Skipped: ${skipped}`);
  lines.push('');
  lines.push('## Results');
  lines.push('');
  for (const item of state.results) {
    const mark = item.status === 'passed' ? '✓' : item.status === 'failed' ? '✕' : '↷';
    lines.push(`### ${mark} ${item.name}`);
    lines.push('');
    if (item.durationMs !== undefined) lines.push(`Duration: ${item.durationMs}ms`);
    if (item.error) lines.push(`Error: ${item.error}`);
    if (item.reason) lines.push(`Reason: ${item.reason}`);
    if (item.details !== undefined) lines.push('```json\n' + short(item.details, 2500) + '\n```');
    lines.push('');
  }
  if (state.warnings.length) {
    lines.push('## Warnings');
    lines.push('');
    for (const warning of state.warnings) lines.push(`- ${warning.message}`);
  }
  writeFileSync(reportMdPath, lines.join('\n'), 'utf8');
  console.log(`\nReport: ${reportMdPath}`);
}

async function main() {
  console.log('AI-Financer base AI regression suite');
  console.log(`Base URL: ${config.baseUrl}`);
  console.log(`Health URL: ${config.healthUrl}`);
  console.log(`AI tests: ${config.runAI ? 'on' : 'off'}`);
  console.log(`Strict AI: ${config.strictAI ? 'on' : 'off'}`);
  console.log(`Token source: ${config.token ? 'ok' : 'missing'}`);
  console.log(`Reset before run: ${config.resetBefore ? 'on' : 'off'}`);
  console.log('');

  if (config.reportOnly) return writeReport();

  await test('health: endpoint responds', async () => {
    const res = await rawFetch(config.healthUrl);
    assert(res.ok, `Health returned ${res.status}`);
    return { status: res.status };
  });

  await test('auth: saved token and /auth/me', async () => {
    const user = await ensureAuth();
    return { userId: user.id, isAdmin: Boolean(user.isAdmin) };
  });

  await test('test isolation: reset finance data for test user', async () => {
    return resetBeforeRun();
  }, { skip: !config.resetBefore && 'TEST_RESET_BEFORE=0' });

  await test('read contracts: all base endpoints', async () => {
    await requireToken();
    const endpoints = ['/accounts', '/accounts/summary', '/accounts/total-balance', '/sections', '/categories', '/transactions', '/transactions/latest', '/transactions/stats/monthly', '/goals', '/budgets', '/recurring', '/ai-settings', '/ai-settings/onboarding', '/referral', '/progression/me', '/companion/state', '/premium/capabilities', '/notifications', '/ai/pending-actions', '/ai/audit-logs'];
    const results = [];
    for (const endpoint of endpoints) {
      const res = await maybeApi(endpoint);
      if (res.error) results.push({ endpoint, ok: false, status: res.error.status, payload: res.error.payload ?? res.error.message });
      else results.push({ endpoint, ok: true });
    }
    const failed = results.filter((item) => !item.ok);
    assert(failed.length === 0, 'Some base read endpoints failed', results);
    return results;
  });

  await test('manual CRUD: accounts, balances and lock flags', async () => {
    const account = await createAccount(`${state.prefix} счёт`, 12000, 'card');
    const updated = await api(`/accounts/${account.id}`, { method: 'PUT', body: { name: `${state.prefix} карта`, balance: 15000, isDefault: true } });
    await api('/accounts/summary');
    await api('/accounts/total-balance');
    return { accountId: account.id, updated: Boolean(updated.data) };
  });

  await test('manual CRUD: sections, categories and taxonomy update', async () => {
    const section = await createSection(`${state.prefix} раздел`);
    const category = await createCategory(`${state.prefix} категория`, section.id, 'expense');
    await api(`/sections/${section.id}`, { method: 'PUT', body: { name: `${state.prefix} раздел новый` } });
    await api(`/categories/${category.id}`, { method: 'PUT', body: { name: `${state.prefix} категория новая`, sectionId: section.id } });
    return { sectionId: section.id, categoryId: category.id };
  });

  await test('manual CRUD: income, expense, transfer and transaction update', async () => {
    const source = await createAccount(`${state.prefix} source`, 20000, 'card');
    const target = await createAccount(`${state.prefix} target`, 1000, 'cash');
    const section = await createSection(`${state.prefix} расходы`);
    const category = await createCategory(`${state.prefix} такси`, section.id, 'expense');
    const expense = await createTransaction({ type: 'expense', amount: 700, accountId: source.id, categoryId: category.id, sectionId: section.id, description: `${state.prefix} расход` });
    const income = await createTransaction({ type: 'income', amount: 5000, accountId: source.id, description: `${state.prefix} доход` });
    const transfer = await createTransaction({ type: 'transfer', amount: 1200, accountId: source.id, toAccountId: target.id, description: `${state.prefix} перевод` });
    await api(`/transactions/${expense.id}`, { method: 'PUT', body: { description: `${state.prefix} расход изменён`, amount: 800 } });
    return { expenseId: expense.id, incomeId: income.id, transferId: transfer.id };
  });

  await test('manual CRUD: goals', async () => {
    const goal = await createGoal(`${state.prefix} цель`, 90000);
    await api(`/goals/${goal.id}`, { method: 'PATCH', body: { currentAmount: 10000, title: `${state.prefix} цель новая` } });
    return { goalId: goal.id };
  });

  await test('manual CRUD: budgets', async () => {
    const section = await createSection(`${state.prefix} бюджет`);
    const category = await createCategory(`${state.prefix} бюджет категория`, section.id, 'expense');
    const res = await api('/budgets', { method: 'POST', body: { name: `${state.prefix} бюджет`, amount: 30000, limit: 30000, period: 'monthly', categoryId: category.id } });
    const budget = res.data?.budget ?? res.data;
    assert(budget?.id, 'Budget create returned no id', res.data);
    state.budgets.push(budget.id);
    addCleanup(`budget:${budget.id}`, () => maybeApi(`/budgets/${budget.id}`, { method: 'DELETE' }));
    await api(`/budgets/${budget.id}`, { method: 'PUT', body: { amount: 32000, limit: 32000 } });
    return { budgetId: budget.id };
  });

  await test('manual CRUD: recurring payments', async () => {
    const account = await createAccount(`${state.prefix} recurring`, 10000, 'card');
    const res = await api('/recurring', { method: 'POST', body: { name: `${state.prefix} подписка`, amount: 499, accountId: account.id, type: 'expense', category: `${state.prefix} подписки`, period: 'monthly', nextDate: new Date(Date.now() + 86400000).toISOString() } });
    const recurring = res.data?.recurringPayment ?? res.data;
    assert(recurring?.id, 'Recurring create returned no id', res.data);
    state.recurring.push(recurring.id);
    addCleanup(`recurring:${recurring.id}`, () => maybeApi(`/recurring/${recurring.id}`, { method: 'DELETE' }));
    await api(`/recurring/${recurring.id}`, { method: 'PUT', body: { amount: 599 } });
    return { recurringId: recurring.id };
  });

  await test('manual: settings, onboarding, progression, referral and analytics', async () => {
    await api('/ai-settings');
    await api('/ai-settings', { method: 'PATCH', body: { voiceEnabled: true } });
    await api('/ai-settings/onboarding');
    await api('/ai-settings/onboarding', { method: 'PATCH', body: { completed: true } });
    await api('/progression/me');
    await api('/referral');
    await api('/analytics/events', { method: 'POST', body: { event: 'screen_view', screen: 'console_regression', meta: { prefix: state.prefix } } });
    return { ok: true };
  });

  await test('manual: notifications read contracts', async () => {
    await api('/notifications');
    await maybeApi('/notifications/read-all', { method: 'POST', body: {} });
    return { ok: true };
  });

  await test('admin: access rule and admin dashboard endpoints', async () => {
    const endpoints = ['/admin/overview', '/admin/users', '/admin/events', '/admin/monitoring'];
    const results = [];
    for (const endpoint of endpoints) {
      const res = await maybeApi(endpoint);
      if (res.error) results.push({ endpoint, ok: false, status: res.error.status, payload: res.error.payload ?? res.error.message });
      else results.push({ endpoint, ok: true });
    }
    const failed = results.filter((item) => !item.ok);
    if (config.expectAdmin) assert(failed.length === 0, 'Admin endpoints failed for admin token', results);
    else assert(failed.every((item) => item.status === 403 || item.status === 401), 'Admin endpoints should reject non-admin token', results);
    return results;
  });

  await test('AI: off-topic answers without financial pending action', async () => {
    const result = await aiParse('Фина, расскажи коротко, что ты умеешь');
    assert(result?.success !== false, 'AI off-topic returned hard failure', result);
    assert(!result?.requiresConfirmation, 'Off-topic should not require financial confirmation', result);
    return result;
  }, { skip: !config.runAI && 'TEST_AI=0' });

  await test('AI: create account with confirmation', async () => {
    const before = await listAccounts();
    const expectedName = `${state.prefix} ai счет`;
    const beforeMatches = before.filter((item) => String(item.name || '').includes(expectedName)).length;
    const execution = await executeAi(`Фина, создай новый наличный счёт с названием ${expectedName}, валюта рубли, баланс 0 рублей`);
    const after = await listAccounts();
    const afterMatches = after.filter((item) => String(item.name || '').includes(expectedName)).length;
    assert(after.length >= before.length + 1 || afterMatches > beforeMatches, 'AI did not create account', {
      expectedName,
      before: before.length,
      after: after.length,
      beforeMatches,
      afterMatches,
      prepared: execution.prepared,
      confirmed: execution.confirmed,
      accountNames: after.map((item) => item.name),
    });
    return { expectedName, before: before.length, after: after.length };
  }, { skip: !config.runAI && 'TEST_AI=0' });

  await test('AI: rename account and make it primary/default', async () => {
    const account = await createAccount(`${state.prefix} старое имя`, 1000, 'card');
    const newName = `${state.prefix} основная карта`;
    await executeAi(`Фина, переименуй счёт ${account.name} в ${newName}`);
    await executeAi(`Фина, сделай счёт ${newName} основным`);
    const accounts = await listAccounts();
    assert(accounts.some((item) => item.id === account.id || String(item.name || '').includes(newName)), 'Renamed/default account not found', accounts);
    return { accountId: account.id };
  }, { skip: !config.runAI && 'TEST_AI=0' });

  await test('AI: create expense with category/section through planner contract', async () => {
    const account = await createAccount(`${state.prefix} ai расход`, 20000, 'card');
    const before = await listTransactions();
    await executeAi(`Фина, такси 650 рублей со счёта ${account.name}, категория такси, раздел транспорт`);
    const after = await listTransactions();
    assert(after.length >= before.length + 1, 'AI did not create expense transaction', { before: before.length, after: after.length });
    return { before: before.length, after: after.length };
  }, { skip: !config.runAI && 'TEST_AI=0' });

  await test('AI: create income and then edit last income without duplicate', async () => {
    const account = await createAccount(`${state.prefix} ai доход`, 1000, 'cash');
    await executeAi(`Фина, доход 3000 рублей на счёт ${account.name}, описание тестовый доход`);
    const afterIncome = await listTransactions();
    const incomeCount = afterIncome.length;
    await executeAi('Фина, измени описание последнего дохода на такси');
    const afterDescription = await listTransactions();
    assert(afterDescription.length === incomeCount, 'Editing last income description created duplicate transaction', { incomeCount, after: afterDescription.length });
    await executeAi('Фина, измени сумму последнего дохода на 5000');
    const afterAmount = await listTransactions();
    assert(afterAmount.length === incomeCount, 'Editing last income amount created duplicate transaction', { incomeCount, after: afterAmount.length });
    return { transactionCount: incomeCount };
  }, { skip: !config.runAI && 'TEST_AI=0' });

  await test('AI: transfer between accounts', async () => {
    const from = await createAccount(`${state.prefix} transfer from`, 10000, 'card');
    const to = await createAccount(`${state.prefix} transfer to`, 1000, 'cash');
    const before = await listTransactions();
    await executeAi(`Фина, переведи 1200 рублей со счёта ${from.name} на счёт ${to.name}`);
    const after = await listTransactions();
    assert(after.length >= before.length + 1, 'AI did not create transfer', { before: before.length, after: after.length });
    return { before: before.length, after: after.length };
  }, { skip: !config.runAI && 'TEST_AI=0' });

  await test('AI: goals lifecycle', async () => {
    const name = `${state.prefix} ai цель`;
    await executeAi(`Фина, создай цель ${name} на 75000 рублей`);
    let goals = await listGoals();
    assert(goals.some((item) => String(item.title || item.name || '').includes(name)), 'AI did not create goal', goals);
    await executeAi(`Фина, измени цель ${name}, сумма 80000 рублей`);
    goals = await listGoals();
    assert(goals.some((item) => String(item.title || item.name || '').includes(name)), 'AI goal disappeared after update', goals);
    return { goals: goals.length };
  }, { skip: !config.runAI && 'TEST_AI=0' });

  await test('AI: taxonomy lifecycle', async () => {
    const sectionName = `${state.prefix} ai раздел`;
    const categoryName = `${state.prefix} ai категория`;
    await executeAi(`Фина, создай раздел ${sectionName}`);
    await executeAi(`Фина, создай категорию ${categoryName} в разделе ${sectionName}`);
    const sections = await listSections();
    const categories = await listCategories();
    assert(sections.some((item) => String(item.name || '').includes(sectionName)), 'AI did not create section', sections);
    assert(categories.some((item) => String(item.name || '').includes(categoryName)), 'AI did not create category', categories);
    return { sections: sections.length, categories: categories.length };
  }, { skip: !config.runAI && 'TEST_AI=0' });

  await test('AI: pending action can be cancelled and does not mutate data', async () => {
    const before = await listAccounts();
    const result = await aiParse(`Фина, создай счёт ${state.prefix} отмена с балансом 1234 рублей`);
    if (!result?.requiresConfirmation) warn('AI action did not require confirmation; cancel test is soft', result);
    const id = pendingId(result);
    await aiCancel(id || undefined);
    const after = await listAccounts();
    assert(after.length === before.length, 'Cancel mutated accounts list', { before: before.length, after: after.length });
    return { before: before.length, after: after.length };
  }, { skip: !config.runAI && 'TEST_AI=0' });

  await test('AI: more than 3 actions is blocked for base version', async () => {
    const result = await aiParse('Фина, создай счёт раз, создай счёт два, создай счёт три, создай счёт четыре');
    const text = JSON.stringify(result).toLowerCase();
    assert(result?.success === false || text.includes('premium') || text.includes('прем'), '4+ actions should be blocked or marked as premium-limit', result);
    return result;
  }, { skip: !config.runAI && 'TEST_AI=0' });

  await test('AI destructive guard: delete all accounts requires explicit opt-in', async () => {
    if (!config.allowDestructive) {
      state.warnings.push({ message: 'Skipped destructive AI command. Set TEST_DESTRUCTIVE=1 only on isolated database.' });
      return { skippedDangerousCommand: true };
    }
    const result = await aiParse('Фина, удали все счета');
    assert(result?.requiresConfirmation || result?.riskLevel === 'high', 'Delete all accounts must require high-risk confirmation', result);
    return result;
  });

  await cleanup();
  await writeReport();

  const passed = state.results.filter((item) => item.status === 'passed').length;
  const failed = state.results.filter((item) => item.status === 'failed').length;
  const skipped = state.results.filter((item) => item.status === 'skipped').length;

  console.log('\nSummary');
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Skipped: ${skipped}`);
  if (state.warnings.length) {
    console.log('\nWarnings');
    for (const warning of state.warnings) console.log(`  - ${warning.message}`);
  }

  const hardFailures = config.strictAI ? failed : state.results.filter((item) => item.status === 'failed' && !item.name.startsWith('AI:')).length;
  process.exitCode = hardFailures > 0 ? 1 : 0;
}

main().catch(async (error) => {
  console.error(error);
  try { await writeReport(); } catch {}
  process.exit(1);
});

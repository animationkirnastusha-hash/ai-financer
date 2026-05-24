#!/usr/bin/env node
/*
  Backend integrity suite for AI-Financer base version.

  This runner checks backend contracts without relying on the external AI model.
  It creates pending AI actions directly from structured tool contracts, confirms
  them through the public backend API, and verifies state changes.

  It does not parse financial user text. It only verifies already-structured
  tool contracts and backend execution lifecycle.
*/

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

dotenv.config({ override: true });

const prisma = new PrismaClient();
const startedAt = new Date();
const stamp = startedAt.toISOString().replace(/[:.]/g, '-');
const reportDir = join(process.cwd(), 'test-results');
const reportJsonPath = join(reportDir, `backend-integrity-${stamp}.json`);
const reportMdPath = join(reportDir, `backend-integrity-${stamp}.md`);

const config = {
  baseUrl: normalizeBaseUrl(process.env.TEST_BASE_URL || 'http://127.0.0.1:3000/api'),
  healthUrl: process.env.TEST_HEALTH_URL || inferHealthUrl(process.env.TEST_BASE_URL || 'http://127.0.0.1:3000/api'),
  token: await readOrCreateToken(),
  timeoutMs: Number(process.env.TEST_TIMEOUT_MS || 30_000),
  keepData: bool(process.env.TEST_KEEP_DATA, false),
  resetBefore: bool(process.env.TEST_RESET_BEFORE, true),
};

const state = {
  userId: decodeUserId(config.token),
  token: config.token,
  prefix: `Интеграция ${randomCyrillic(6)}`,
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

function readTelegramId() {
  const raw = process.env.TEST_TELEGRAM_ID || process.env.DEV_TELEGRAM_ID || process.env.ADMIN_TELEGRAM_ID || '516730814';
  const parsed = BigInt(String(raw));
  if (parsed <= 0n) throw new Error('TEST_TELEGRAM_ID must be a positive integer');
  return parsed;
}

function readAdminTelegramIds() {
  const values = [process.env.ADMIN_TELEGRAM_ID, ...(process.env.ADMIN_TELEGRAM_IDS || '').split(',')]
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  return new Set(values);
}

async function readOrCreateToken() {
  const direct = String(process.env.TEST_AUTH_TOKEN || '').trim();
  if (direct) return direct;

  const tokenFile = process.env.TEST_AUTH_TOKEN_FILE || join(process.cwd(), '.test-auth-token');
  if (existsSync(tokenFile)) {
    const saved = readFileSync(tokenFile, 'utf8').trim();
    if (saved) return saved;
  }

  const jwtSecret = process.env.JWT_SECRET || 'dev-secret';
  const telegramId = readTelegramId();
  const telegramIdText = telegramId.toString();
  const adminIds = readAdminTelegramIds();
  const isAdmin = process.env.TEST_ADMIN === '1' || adminIds.has(telegramIdText);

  const user = await prisma.user.upsert({
    where: { telegramId },
    update: {
      firstName: isAdmin ? 'Admin' : 'Integrity',
      lastName: 'Tester',
      username: isAdmin ? 'admin_integrity' : `integrity_${telegramIdText}`,
      isAdmin,
    },
    create: {
      telegramId,
      firstName: isAdmin ? 'Admin' : 'Integrity',
      lastName: 'Tester',
      username: isAdmin ? 'admin_integrity' : `integrity_${telegramIdText}`,
      isAdmin,
    },
  });

  const token = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: '30d' });
  writeFileSync(tokenFile, `${token}\n`, 'utf8');
  writeFileSync(join(process.cwd(), '.test-auth-token.env'), `TEST_AUTH_TOKEN=${token}\nTEST_TELEGRAM_ID=${telegramIdText}\nTEST_ADMIN=${isAdmin ? '1' : '0'}\n`, 'utf8');
  console.error(`Auto-created test token for user: ${user.id} telegramId=${telegramIdText} admin=${user.isAdmin}`);
  return token;
}

function decodeUserId(token) {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded !== 'object' || typeof decoded.userId !== 'string') {
    throw new Error('Test token does not contain userId');
  }
  return decoded.userId;
}

function randomCyrillic(length = 8) {
  const alphabet = 'абвгдежзиклмнопрстуфхцчшэюя';
  let value = '';
  for (let i = 0; i < length; i += 1) value += alphabet[Math.floor(Math.random() * alphabet.length)];
  return value;
}

function nowMs() {
  return Math.round(performance.now());
}

function short(value, length = 900) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

function assert(condition, message, details) {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

function addCleanup(label, fn) {
  if (!config.keepData) state.cleanup.push({ label, fn });
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

async function test(name, fn) {
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
    console.log(`  ${short(details, 900)}`);
  }
}

function pickArrayPayload(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ['accounts', 'transactions', 'goals', 'sections', 'categories', 'budgets', 'recurringPayments', 'items', 'data']) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}

async function list(path) {
  return pickArrayPayload((await api(path)).data);
}

async function resetFinance() {
  const res = await api('/users/me/reset', { method: 'POST', body: { mode: 'finance' } });
  return res.data;
}

async function createAccount(name, balance = 0, type = 'cash') {
  const res = await api('/accounts', { method: 'POST', body: { name, type, currency: 'RUB', balance } });
  const account = res.data?.account ?? res.data;
  assert(account?.id, 'Account create returned no id', res.data);
  addCleanup(`account:${name}`, () => maybeApi(`/accounts/${account.id}`, { method: 'DELETE' }));
  return account;
}

async function insertPending(command, parsed, riskLevel = 'medium') {
  const row = await prisma.aIPendingAction.create({
    data: {
      userId: state.userId,
      command,
      intent: parsed.intent,
      riskLevel,
      parsed: JSON.stringify(parsed),
      status: 'pending',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });
  return row.id;
}

function batch(summary, actions) {
  return { intent: 'batch', summary, actions };
}

function action(tool, input, resolved = {}, riskLevel = 'medium', requiresConfirmation = true) {
  return { tool, input, resolved, riskLevel, requiresConfirmation };
}

async function confirmPending(pendingActionId) {
  const res = await api(`/ai/confirm/${encodeURIComponent(pendingActionId)}`, { method: 'POST', body: { pendingActionId } });
  const result = res.data?.result ?? res.data;
  assert(result?.success !== false, 'Confirm returned failure', result);
  assert(result?.executed === true, 'Confirm did not report executed=true', result);
  return result;
}

async function assertNoFinancialParserPatterns() {
  const files = await import('node:fs/promises');
  const path = await import('node:path');
  const aiDir = path.join(process.cwd(), 'src/modules/ai');
  const banned = [
    'extractMoneyAmountFromText',
    'collectMoneyCandidates',
    'MONEY_CONTEXT_WORDS',
    'CURRENCY_WORDS =',
    'regex.exec(text)',
    'command-parser',
    'parseFinancial',
  ];
  const offenders = [];

  async function walk(dir) {
    const entries = await files.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'providers' || entry.name === '__tests__') continue;
        await walk(full);
        continue;
      }
      if (!entry.name.endsWith('.ts')) continue;
      const text = await files.readFile(full, 'utf8');
      for (const pattern of banned) {
        if (text.includes(pattern)) offenders.push({ file: path.relative(process.cwd(), full), pattern });
      }
    }
  }

  await walk(aiDir);
  assert(offenders.length === 0, 'Found banned financial parser patterns in AI module', offenders);
  return { checked: aiDir, bannedPatterns: banned.length };
}

async function main() {
  mkdirSync(reportDir, { recursive: true });

  console.log('AI-Financer backend integrity suite');
  console.log(`Base URL: ${config.baseUrl}`);
  console.log(`Health URL: ${config.healthUrl}`);
  console.log(`User: ${state.userId}`);
  console.log(`Reset before run: ${config.resetBefore ? 'on' : 'off'}`);

  await test('health endpoint responds', async () => {
    const res = await rawFetch(config.healthUrl);
    assert(res.ok, `health failed with ${res.status}`);
    return { status: res.status };
  });

  await test('auth token works', async () => {
    const res = await api('/auth/me');
    assert(res.data?.user?.id || res.data?.id, 'auth/me returned no user', res.data);
    return res.data;
  });

  await test('static guard: no financial command parsers in AI module', assertNoFinancialParserPatterns);

  if (config.resetBefore) {
    await test('reset finance data for integrity user', resetFinance);
  }

  await test('confirm lifecycle: create account mutates state', async () => {
    const name = `${state.prefix} новый счёт`;
    const before = await list('/accounts');
    const pendingId = await insertPending(`Создать счёт ${name}`, batch(`Создать счёт ${name}`, [
      action('create_account', { name, type: 'cash', currency: 'RUB', initialBalance: 0 }, {}, 'medium', true),
    ]));
    const confirmed = await confirmPending(pendingId);
    const after = await list('/accounts');
    assert(after.length === before.length + 1, 'Account count did not change after confirm', { before: before.length, after: after.length, confirmed, accounts: after.map((item) => item.name) });
    assert(after.some((item) => item.name === name), 'Created account not found after confirm', { name, accounts: after.map((item) => item.name), confirmed });
    return { name, confirmed };
  });

  await test('confirm lifecycle: update account mutates existing account', async () => {
    const account = await createAccount(`${state.prefix} старое имя`, 1000, 'card');
    const nextName = `${state.prefix} новое имя`;
    const pendingId = await insertPending(`Переименовать счёт ${account.name}`, batch('Переименовать счёт', [
      action('update_account', { account: account.name, name: nextName }, { accountId: account.id }, 'medium', true),
    ]));
    const confirmed = await confirmPending(pendingId);
    const accounts = await list('/accounts');
    assert(accounts.some((item) => item.id === account.id && item.name === nextName), 'Account name did not update after confirm', { confirmed, accounts });
    return { accountId: account.id, nextName };
  });

  await test('confirm lifecycle: create expense transaction and balance effect', async () => {
    const account = await createAccount(`${state.prefix} расходный счёт`, 10000, 'card');
    const beforeTx = await list('/transactions');
    const pendingId = await insertPending('Создать расход 650', batch('Расход 650', [
      action('create_transaction', { kind: 'expense', amount: 650, account: account.name, category: 'такси', section: 'транспорт', description: 'такси', currency: 'RUB' }, { accountId: account.id, accountCurrency: 'RUB', amountInAccountCurrency: 650 }, 'low', true),
    ]), 'low');
    const confirmed = await confirmPending(pendingId);
    const afterTx = await list('/transactions');
    const accounts = await list('/accounts');
    const updated = accounts.find((item) => item.id === account.id);
    assert(afterTx.length === beforeTx.length + 1, 'Expense transaction was not created after confirm', { before: beforeTx.length, after: afterTx.length, confirmed });
    assert(updated?.balance === 9350, 'Expense did not decrement account balance', { updated, confirmed });
    return { transactionCount: afterTx.length, balance: updated?.balance };
  });

  await test('confirm lifecycle: create income and edit without duplicate', async () => {
    const account = await createAccount(`${state.prefix} доходный счёт`, 1000, 'cash');
    const incomePending = await insertPending('Создать доход 3000', batch('Доход 3000', [
      action('create_transaction', { kind: 'income', amount: 3000, account: account.name, category: 'поступления', section: 'доходы', description: 'тестовый доход', currency: 'RUB' }, { accountId: account.id, accountCurrency: 'RUB', amountInAccountCurrency: 3000 }, 'low', true),
    ]), 'low');
    await confirmPending(incomePending);
    const transactions = await list('/transactions');
    const income = transactions.find((item) => item.description === 'тестовый доход');
    assert(income?.id, 'Income transaction not found', transactions);

    const editPending = await insertPending('Изменить доход', batch('Изменить доход', [
      action('update_transaction', { transaction: 'последний доход', target: 'last_income', description: 'такси' }, { transactionId: income.id }, 'medium', true),
    ]));
    await confirmPending(editPending);
    const after = await list('/transactions');
    assert(after.length === transactions.length, 'Editing income created duplicate transaction', { before: transactions.length, after: after.length });
    assert(after.some((item) => item.id === income.id && item.description === 'такси'), 'Income description did not update', after);
    return { transactionId: income.id, transactionCount: after.length };
  });

  await test('confirm lifecycle: transfer creates transfer and moves balances', async () => {
    const from = await createAccount(`${state.prefix} источник`, 10000, 'card');
    const to = await createAccount(`${state.prefix} получатель`, 1000, 'cash');
    const beforeTx = await list('/transactions');
    const pendingId = await insertPending('Перевод 1200', batch('Перевод 1200', [
      action('transfer_money', { fromAccount: from.name, toAccount: to.name, amount: 1200, currency: 'RUB', description: 'перевод' }, { fromAccountId: from.id, toAccountId: to.id, amountInFromCurrency: 1200 }, 'high', true),
    ]), 'high');
    const confirmed = await confirmPending(pendingId);
    const afterTx = await list('/transactions');
    const accounts = await list('/accounts');
    assert(afterTx.length === beforeTx.length + 1, 'Transfer transaction was not created', { before: beforeTx.length, after: afterTx.length, confirmed });
    assert(accounts.find((item) => item.id === from.id)?.balance === 8800, 'From account balance is wrong', accounts);
    assert(accounts.find((item) => item.id === to.id)?.balance === 2200, 'To account balance is wrong', accounts);
    return { transferCount: afterTx.length };
  });

  await test('confirm lifecycle: create goal', async () => {
    const title = `${state.prefix} цель`;
    const pendingId = await insertPending(`Создать цель ${title}`, batch('Создать цель', [
      action('create_goal', { title, targetAmount: 75000, currentAmount: 0, currency: 'RUB', note: '' }, {}, 'medium', true),
    ]));
    await confirmPending(pendingId);
    const goals = await list('/goals');
    assert(goals.some((item) => item.title === title), 'Goal was not created after confirm', goals);
    return { goals: goals.length };
  });

  await test('confirm lifecycle: create section and category', async () => {
    const section = `${state.prefix} раздел`;
    const category = `${state.prefix} категория`;
    const pendingId = await insertPending('Создать раздел и категорию', batch('Раздел и категория', [
      action('create_section', { name: section }, {}, 'medium', true),
      action('create_category', { name: category, type: 'expense', section }, {}, 'medium', true),
    ]));
    await confirmPending(pendingId);
    const sections = await list('/sections');
    const categories = await list('/categories');
    assert(sections.some((item) => item.name === section), 'Section was not created after confirm', sections);
    assert(categories.some((item) => item.name === category), 'Category was not created after confirm', categories);
    return { sections: sections.length, categories: categories.length };
  });

  await test('pending cancel does not mutate state', async () => {
    const name = `${state.prefix} отмена`;
    const before = await list('/accounts');
    const pendingId = await insertPending(`Создать счёт ${name}`, batch(`Создать счёт ${name}`, [
      action('create_account', { name, type: 'cash', currency: 'RUB', initialBalance: 0 }, {}, 'medium', true),
    ]));
    const res = await api(`/ai/cancel/${encodeURIComponent(pendingId)}`, { method: 'POST', body: { pendingActionId: pendingId } });
    const cancelled = res.data?.result ?? res.data;
    assert(cancelled?.success !== false, 'Cancel failed', cancelled);
    const after = await list('/accounts');
    assert(after.length === before.length, 'Cancel changed account count', { before: before.length, after: after.length });
    return { before: before.length, after: after.length };
  });

  console.log('\nCleanup');
  for (const item of state.cleanup.reverse()) {
    try { await item.fn(); } catch (error) { state.warnings.push({ message: `cleanup failed: ${item.label}`, details: error.message }); }
  }

  const finishedAt = new Date();
  const passed = state.results.filter((item) => item.status === 'passed').length;
  const failed = state.results.filter((item) => item.status === 'failed').length;
  const report = { startedAt, finishedAt, config: { ...config, token: config.token ? '[redacted]' : '' }, results: state.results, warnings: state.warnings };
  writeFileSync(reportJsonPath, JSON.stringify(report, null, 2), 'utf8');
  writeFileSync(reportMdPath, renderMarkdown(report), 'utf8');

  console.log(`\nReport: ${reportMdPath}`);
  console.log('\nSummary');
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Warnings: ${state.warnings.length}`);

  await prisma.$disconnect();
  if (failed > 0) process.exitCode = 1;
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# AI-Financer backend integrity report');
  lines.push('');
  lines.push(`Started: ${report.startedAt.toISOString()}`);
  lines.push(`Finished: ${report.finishedAt.toISOString()}`);
  lines.push('');
  lines.push('## Results');
  lines.push('');
  for (const item of report.results) {
    lines.push(`- ${item.status === 'passed' ? '✅' : '❌'} ${item.name} (${item.durationMs ?? 0}ms)`);
    if (item.status === 'failed') {
      lines.push('');
      lines.push('```json');
      lines.push(JSON.stringify(item.details ?? item.error, null, 2));
      lines.push('```');
      lines.push('');
    }
  }
  if (report.warnings.length) {
    lines.push('## Warnings');
    for (const warning of report.warnings) lines.push(`- ${warning.message}`);
  }
  return `${lines.join('\n')}\n`;
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});

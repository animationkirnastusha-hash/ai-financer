#!/usr/bin/env node
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const startedAt = new Date();
const results = [];
const warnings = [];
const root = process.cwd();
const reportDir = path.join(root, 'test-results');

const telegramId = BigInt(process.env.TEST_TELEGRAM_ID || '516730814');
const prefix = `Интеграция ${randomToken()}`;
let aiService = null;
let user = null;

function randomToken() {
  const alphabet = 'абвгдежзиклмнопрстуфхцчшэюя';
  let value = '';
  for (let i = 0; i < 7; i += 1) value += alphabet[Math.floor(Math.random() * alphabet.length)];
  return value;
}

function nowIsoFile() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function run(name, fn) {
  const start = Date.now();
  try {
    const details = await fn();
    results.push({ name, status: 'passed', durationMs: Date.now() - start, details });
    console.log(`✓ ${name} (${Date.now() - start}ms)`);
  } catch (error) {
    const details = error?.details ?? error?.response ?? error?.data ?? error?.message ?? String(error);
    results.push({ name, status: 'failed', durationMs: Date.now() - start, error: error?.message ?? String(error), details });
    console.log(`✕ ${name} (${Date.now() - start}ms)`);
    console.log(JSON.stringify(details, null, 2));
  }
}

function fail(message, details = null) {
  const error = new Error(message);
  error.details = details ?? message;
  throw error;
}

function assert(condition, message, details = null) {
  if (!condition) fail(message, details);
}

async function loadAiService() {
  const servicePath = path.join(root, 'dist/modules/ai/service.js');
  try {
    await fs.access(servicePath);
  } catch {
    fail('dist/modules/ai/service.js not found. Run npm run build before npm run test:backend-integrity.');
  }
  const mod = await import(pathToFileURL(servicePath).href);
  if (!mod.AIService) fail('AIService export not found in dist/modules/ai/service.js');
  aiService = new mod.AIService();
}

async function ensureUser() {
  user = await prisma.user.upsert({
    where: { telegramId },
    create: {
      telegramId,
      firstName: 'Integrity',
      lastName: 'Tester',
      username: `integrity_${String(telegramId)}`,
      isAdmin: true,
      referralCode: `INT${Date.now().toString(36).toUpperCase()}`,
    },
    update: { isAdmin: true, firstName: 'Integrity', lastName: 'Tester' },
  });
  return user;
}

async function cleanupUserData(userId) {
  const safe = async (label, fn) => {
    try { await fn(); } catch (error) { warnings.push(`cleanup ${label}: ${error?.message ?? error}`); }
  };

  await safe('ai pending', () => prisma.aIPendingAction.deleteMany({ where: { userId } }));
  await safe('ai audit', () => prisma.aIAuditLog.deleteMany({ where: { userId } }));
  await safe('ai messages', () => prisma.aIMessage.deleteMany({ where: { userId } }));
  await safe('ai session', () => prisma.aISessionState.deleteMany({ where: { userId } }));
  await safe('ai operation events', () => prisma.aIOperationEvent.deleteMany({ where: { userId } }));
  await safe('budgets', () => prisma.budget.deleteMany({ where: { userId } }));
  await safe('recurring', () => prisma.recurringPayment.deleteMany({ where: { userId } }));
  await safe('transactions', () => prisma.transaction.deleteMany({ where: { userId } }));
  await safe('goals', () => prisma.goal.deleteMany({ where: { userId } }));
  await safe('categories', () => prisma.category.deleteMany({ where: { userId } }));
  await safe('sections', () => prisma.section.deleteMany({ where: { userId } }));
  await safe('accounts', () => prisma.account.deleteMany({ where: { userId } }));
}

function action(tool, input, resolved = {}, riskLevel = 'medium') {
  return { tool, input, resolved, riskLevel, requiresConfirmation: true };
}

function parsed(summary, actions) {
  return { intent: 'batch', summary, actions };
}

async function createPending(userId, plan, command = plan.summary, riskLevel = 'medium') {
  return prisma.aIPendingAction.create({
    data: {
      userId,
      command,
      intent: plan.intent,
      riskLevel,
      parsed: JSON.stringify(plan),
      status: 'pending',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });
}

async function confirmPlan(plan, command, riskLevel = 'medium') {
  const pending = await createPending(user.id, plan, command, riskLevel);
  const result = await aiService.confirmCommand(user.id, pending.id);
  assert(result?.success === true && result?.executed === true, 'confirm did not execute pending action', { pendingId: pending.id, result });

  const row = await prisma.aIPendingAction.findUnique({ where: { id: pending.id } });
  assert(row?.status === 'confirmed', 'pending action was not marked confirmed', { pendingId: pending.id, row, result });
  return result;
}

async function staticGuard() {
  const dir = path.join(root, 'src/modules/ai');
  const files = await listFiles(dir);
  const forbidden = [
    { pattern: 'command-parser', reason: 'literal command-parser marker' },
    { pattern: 'collectMoneyCandidates', reason: 'money extraction helper' },
    { pattern: 'extractMoneyAmountFromText(', reason: 'natural-language amount extraction' },
    { pattern: 'new RegExp(', reason: 'dynamic regular expression in AI module' },
    { pattern: 'regex.exec(', reason: 'regex scanning in AI module' },
  ];

  const violations = [];
  for (const file of files) {
    if (!file.endsWith('.ts')) continue;
    if (file.includes(`${path.sep}__tests__${path.sep}`)) continue;
    const rel = path.relative(root, file).replaceAll(path.sep, '/');
    const text = await fs.readFile(file, 'utf8');
    for (const item of forbidden) {
      if (text.includes(item.pattern)) violations.push({ file: rel, pattern: item.pattern, reason: item.reason });
    }
  }
  assert(violations.length === 0, 'financial parser guard failed', violations);
  return { checkedFiles: files.length };
}

async function listFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await listFiles(full));
    else out.push(full);
  }
  return out;
}

async function main() {
  console.log('AI-Financer backend integrity suite');
  console.log(`Mode: direct backend service, no external AI provider`);
  console.log(`Telegram ID: ${telegramId}`);
  console.log(`Prefix: ${prefix}`);
  console.log('');

  await run('bootstrap: load compiled AI service', async () => loadAiService());
  await run('static guard: no financial command parsers in AI module', async () => staticGuard());
  await run('bootstrap: create/find integrity user', async () => ensureUser());
  await run('reset finance data for integrity user', async () => cleanupUserData(user.id));

  await run('confirm lifecycle: create account mutates state', async () => {
    const name = `${prefix} новый счёт`;
    await confirmPlan(parsed(`Создать счёт ${name}`, [action('create_account', { name, type: 'cash', currency: 'RUB', initialBalance: 0 })]), `Создать счёт ${name}`);
    const account = await prisma.account.findFirst({ where: { userId: user.id, name } });
    assert(Boolean(account), 'account was not created', { name });
    return { accountId: account.id, name: account.name };
  });

  await run('confirm lifecycle: update account mutates existing account', async () => {
    const oldName = `${prefix} старое имя`;
    const nextName = `${prefix} новое имя`;
    const account = await prisma.account.create({ data: { userId: user.id, name: oldName, type: 'card', currency: 'RUB', balance: 1000, showInTotalBalance: true } });
    await confirmPlan(parsed('Переименовать счёт', [action('update_account', { account: oldName, name: nextName }, { accountId: account.id })]), 'Переименовать счёт');
    const updated = await prisma.account.findUnique({ where: { id: account.id } });
    assert(updated?.name === nextName, 'account was not renamed', { updated });
    return { accountId: updated.id, name: updated.name };
  });

  await run('confirm lifecycle: create expense transaction and balance effect', async () => {
    const account = await prisma.account.create({ data: { userId: user.id, name: `${prefix} расходный счёт`, type: 'card', currency: 'RUB', balance: 1000, showInTotalBalance: true } });
    await confirmPlan(parsed('Расход 650', [action('create_transaction', { kind: 'expense', amount: 650, account: account.name, category: 'такси', section: 'транспорт', description: 'такси', currency: 'RUB' }, { accountId: account.id })]), 'Расход 650', 'low');
    const [updated, transaction] = await Promise.all([
      prisma.account.findUnique({ where: { id: account.id } }),
      prisma.transaction.findFirst({ where: { userId: user.id, accountId: account.id, type: 'expense', amount: 650 } }),
    ]);
    assert(updated?.balance === 350 && Boolean(transaction), 'expense did not mutate balance/transaction', { balance: updated?.balance, transaction });
    return { balance: updated.balance, transactionId: transaction.id };
  });

  await run('confirm lifecycle: create income and edit without duplicate', async () => {
    const account = await prisma.account.create({ data: { userId: user.id, name: `${prefix} доходный счёт`, type: 'card', currency: 'RUB', balance: 0, showInTotalBalance: true } });
    await confirmPlan(parsed('Доход 3000', [action('create_transaction', { kind: 'income', amount: 3000, account: account.name, category: 'зарплата', section: 'доходы', description: 'тестовый доход', currency: 'RUB' }, { accountId: account.id })]), 'Доход 3000', 'low');
    const income = await prisma.transaction.findFirst({ where: { userId: user.id, accountId: account.id, type: 'income' }, orderBy: { createdAt: 'desc' } });
    assert(Boolean(income), 'income transaction was not created');
    await confirmPlan(parsed('Изменить доход', [action('update_transaction', { target: 'last_income', amount: 5000, description: 'такси' }, { transactionId: income.id })]), 'Изменить доход');
    const [count, updatedTransaction, updatedAccount] = await Promise.all([
      prisma.transaction.count({ where: { userId: user.id, accountId: account.id, type: 'income' } }),
      prisma.transaction.findUnique({ where: { id: income.id } }),
      prisma.account.findUnique({ where: { id: account.id } }),
    ]);
    assert(count === 1 && updatedTransaction?.amount === 5000 && updatedTransaction?.description === 'такси' && updatedAccount?.balance === 5000, 'income edit created duplicate or wrong balance', { count, updatedTransaction, balance: updatedAccount?.balance });
    return { transactionId: income.id, count, balance: updatedAccount.balance };
  });

  await run('confirm lifecycle: transfer creates transfer and moves balances', async () => {
    const from = await prisma.account.create({ data: { userId: user.id, name: `${prefix} источник`, type: 'card', currency: 'RUB', balance: 5000, showInTotalBalance: true } });
    const to = await prisma.account.create({ data: { userId: user.id, name: `${prefix} получатель`, type: 'cash', currency: 'RUB', balance: 0, showInTotalBalance: true } });
    await confirmPlan(parsed('Перевод 1200', [action('transfer_money', { fromAccount: from.name, toAccount: to.name, amount: 1200, currency: 'RUB', description: 'перевод' }, { fromAccountId: from.id, toAccountId: to.id })]), 'Перевод 1200', 'high');
    const [nextFrom, nextTo, transfer] = await Promise.all([
      prisma.account.findUnique({ where: { id: from.id } }),
      prisma.account.findUnique({ where: { id: to.id } }),
      prisma.transaction.findFirst({ where: { userId: user.id, accountId: from.id, toAccountId: to.id, type: 'transfer', amount: 1200 } }),
    ]);
    assert(nextFrom?.balance === 3800 && nextTo?.balance === 1200 && Boolean(transfer), 'transfer did not mutate balances/transaction', { from: nextFrom?.balance, to: nextTo?.balance, transfer });
    return { fromBalance: nextFrom.balance, toBalance: nextTo.balance, transactionId: transfer.id };
  });

  await run('confirm lifecycle: create goal', async () => {
    const title = `${prefix} цель отпуска`;
    await confirmPlan(parsed(`Создать цель ${title}`, [action('create_goal', { title, targetAmount: 75000, currentAmount: 0, currency: 'RUB', note: '' })]), `Создать цель ${title}`);
    const goal = await prisma.goal.findFirst({ where: { userId: user.id, title } });
    assert(goal?.targetAmount === 75000, 'goal was not created', { goal });
    return { goalId: goal.id, title: goal.title };
  });

  await run('confirm lifecycle: create section and category', async () => {
    const sectionName = `${prefix} раздел покупок`;
    const categoryName = `${prefix} категория такси`;
    await confirmPlan(parsed('Создать раздел и категорию', [
      action('create_section', { name: sectionName }),
      action('create_category', { name: categoryName, type: 'expense', section: sectionName }),
    ]), 'Создать раздел и категорию');
    const section = await prisma.section.findFirst({ where: { userId: user.id, name: sectionName } });
    const category = await prisma.category.findFirst({ where: { userId: user.id, name: categoryName } });
    assert(Boolean(section) && category?.sectionId === section?.id, 'section/category were not linked', { section, category });
    return { sectionId: section.id, categoryId: category.id };
  });

  await run('pending cancel does not mutate state', async () => {
    const name = `${prefix} отменённый счёт`;
    const plan = parsed(`Создать счёт ${name}`, [action('create_account', { name, type: 'cash', currency: 'RUB', initialBalance: 0 })]);
    const pending = await createPending(user.id, plan, plan.summary);
    const result = await aiService.cancelCommand(user.id, pending.id);
    const account = await prisma.account.findFirst({ where: { userId: user.id, name } });
    assert(result?.success === true && !account, 'cancel mutated state or failed', { result, account });
    return { pendingId: pending.id };
  });

  console.log('\nCleanup');
  await fs.mkdir(reportDir, { recursive: true });
  const finishedAt = new Date();
  const passed = results.filter((item) => item.status === 'passed').length;
  const failed = results.filter((item) => item.status === 'failed').length;
  const reportBase = path.join(reportDir, `backend-integrity-${nowIsoFile()}`);
  const jsonPath = `${reportBase}.json`;
  const mdPath = `${reportBase}.md`;
  await fs.writeFile(jsonPath, JSON.stringify({ startedAt, finishedAt, prefix, results, warnings, summary: { passed, failed } }, null, 2));
  await fs.writeFile(mdPath, renderMarkdown({ startedAt, finishedAt, prefix, results, warnings, passed, failed }));
  console.log(`\nReport: ${mdPath}`);
  console.log('\nSummary');
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Warnings: ${warnings.length}`);
  if (warnings.length) for (const warning of warnings) console.log(`  - ${warning}`);

  await prisma.$disconnect();
  if (failed > 0) process.exit(1);
}

function renderMarkdown({ startedAt, finishedAt, prefix, results, warnings, passed, failed }) {
  const lines = [];
  lines.push('# Backend integrity suite');
  lines.push('');
  lines.push(`Started: ${startedAt.toISOString()}`);
  lines.push(`Finished: ${finishedAt.toISOString()}`);
  lines.push(`Prefix: ${prefix}`);
  lines.push('');
  lines.push(`Passed: ${passed}`);
  lines.push(`Failed: ${failed}`);
  lines.push('');
  for (const item of results) {
    lines.push(`## ${item.status === 'passed' ? '✓' : '✕'} ${item.name}`);
    lines.push(`Duration: ${item.durationMs}ms`);
    if (item.status === 'failed') {
      lines.push('');
      lines.push('```json');
      lines.push(JSON.stringify(item.details ?? item.error, null, 2));
      lines.push('```');
    }
    lines.push('');
  }
  if (warnings.length) {
    lines.push('## Warnings');
    for (const warning of warnings) lines.push(`- ${warning}`);
  }
  return `${lines.join('\n')}\n`;
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect().catch(() => null);
  process.exit(1);
});

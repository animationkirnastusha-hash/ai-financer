#!/usr/bin/env node
/*
  HTTP confirmation endpoint smoke test.

  This script does not use the external AI provider and does not parse financial text.
  It creates one pending action with a ready tool contract directly in DB, then confirms it
  through the public HTTP endpoint POST /api/ai/confirm/:pendingActionId.
*/
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const root = process.cwd();
const startedAt = new Date();
const stamp = startedAt.toISOString().replace(/[:.]/g, '-');
const reportDir = path.join(root, 'test-results');
const reportPath = path.join(reportDir, `http-confirm-smoke-${stamp}.json`);
const baseUrl = normalizeBaseUrl(process.env.TEST_BASE_URL || 'http://127.0.0.1:3000/api');
const healthUrl = process.env.TEST_HEALTH_URL || inferHealthUrl(baseUrl);
const telegramId = BigInt(process.env.TEST_TELEGRAM_ID || '516730814');
const prefix = `HTTP подтверждение ${randomToken()}`;
const results = [];

function normalizeBaseUrl(value) { return String(value || '').replace(/\/+$/, ''); }
function inferHealthUrl(value) { const clean = normalizeBaseUrl(value); return clean.endsWith('/api') ? `${clean.slice(0, -4)}/health` : `${clean}/health`; }
function randomToken() { const alphabet = 'абвгдежзиклмнопрстуфхцчшэюя'; let out=''; for(let i=0;i<7;i++) out += alphabet[Math.floor(Math.random()*alphabet.length)]; return out; }
function safeStringify(value) { return JSON.stringify(value, (_k, item) => typeof item === 'bigint' ? item.toString() : item, 2); }
function assert(condition, message, details) { if (!condition) { const e = new Error(message); e.details = details; throw e; } }

async function run(name, fn) {
  const start = Date.now();
  try {
    const details = await fn();
    results.push({ name, status: 'passed', durationMs: Date.now() - start, details });
    console.log(`✓ ${name} (${Date.now() - start}ms)`);
  } catch (error) {
    const details = error.details ?? error.payload ?? error.message ?? String(error);
    results.push({ name, status: 'failed', durationMs: Date.now() - start, error: error.message ?? String(error), details });
    console.log(`✕ ${name} (${Date.now() - start}ms)`);
    console.log(safeStringify(details));
  }
}

async function createUserAndToken() {
  const telegramIdText = telegramId.toString();
  const isAdmin = process.env.TEST_ADMIN === '1';
  const user = await prisma.user.upsert({
    where: { telegramId },
    update: { isAdmin, firstName: 'HttpConfirm', lastName: 'Tester' },
    create: {
      telegramId,
      firstName: 'HttpConfirm',
      lastName: 'Tester',
      username: `http_confirm_${telegramIdText}`,
      isAdmin,
      referralCode: `HTTP${Date.now().toString(36).toUpperCase()}`,
    },
  });
  const token = jwt.sign({ userId: user.id, sub: user.id }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: process.env.AUTH_ACCESS_TOKEN_TTL || '12h', issuer: process.env.AUTH_JWT_ISSUER || 'ai-financer-api', audience: process.env.AUTH_JWT_AUDIENCE || 'ai-financer-web' });
  fs.writeFileSync(path.join(root, '.test-auth-token'), `${token}\n`, 'utf8');
  return { user, token };
}

async function cleanupUserData(userId) {
  const safe = async (fn) => { try { await fn(); } catch {} };
  await safe(() => prisma.aIPendingAction.deleteMany({ where: { userId } }));
  await safe(() => prisma.aIAuditLog.deleteMany({ where: { userId } }));
  await safe(() => prisma.aIMessage.deleteMany({ where: { userId } }));
  await safe(() => prisma.aISessionState.deleteMany({ where: { userId } }));
  await safe(() => prisma.aIOperationEvent.deleteMany({ where: { userId } }));
  await safe(() => prisma.budget.deleteMany({ where: { userId } }));
  await safe(() => prisma.recurringPayment.deleteMany({ where: { userId } }));
  await safe(() => prisma.transaction.deleteMany({ where: { userId } }));
  await safe(() => prisma.goal.deleteMany({ where: { userId } }));
  await safe(() => prisma.category.deleteMany({ where: { userId } }));
  await safe(() => prisma.section.deleteMany({ where: { userId } }));
  await safe(() => prisma.account.deleteMany({ where: { userId } }));
}

async function rawFetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await res.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch { data = text; } }
  if (!res.ok) { const e = new Error(`${options.method || 'GET'} ${url} failed with ${res.status}`); e.status = res.status; e.payload = data; throw e; }
  return data;
}

function parsedCreateAccount(name) {
  return {
    intent: 'batch',
    summary: `Создать счёт ${name}`,
    actions: [{
      tool: 'create_account',
      input: { name, type: 'cash', currency: 'RUB', initialBalance: 0 },
      resolved: {},
      riskLevel: 'medium',
      requiresConfirmation: true,
    }],
  };
}

async function createPending(userId, plan) {
  return prisma.aIPendingAction.create({
    data: {
      userId,
      command: plan.summary,
      intent: plan.intent,
      riskLevel: 'medium',
      parsed: JSON.stringify(plan),
      status: 'pending',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });
}

async function main() {
  console.log('AI-Financer HTTP confirm smoke');
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Health URL: ${healthUrl}`);
  console.log(`Prefix: ${prefix}`);
  console.log('');

  let context = null;
  await run('health: endpoint responds', async () => rawFetchJson(healthUrl));
  await run('bootstrap: user, token and clean finance data', async () => {
    context = await createUserAndToken();
    await cleanupUserData(context.user.id);
    return { userId: context.user.id, telegramId: telegramId.toString() };
  });
  await run('http confirm: pending action mutates state', async () => {
    const accountName = `${prefix} новый счёт`;
    const plan = parsedCreateAccount(accountName);
    const pending = await createPending(context.user.id, plan);
    const response = await rawFetchJson(`${baseUrl}/ai/confirm/${encodeURIComponent(pending.id)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${context.token}` },
      body: { pendingActionId: pending.id },
    });
    const executionResult = response?.result ?? null;
    assert(response?.success === true && response?.executed === true, 'HTTP confirm returned non-executed response', { response, executionResult });
    const [account, pendingAfter] = await Promise.all([
      prisma.account.findFirst({ where: { userId: context.user.id, name: accountName } }),
      prisma.aIPendingAction.findUnique({ where: { id: pending.id } }),
    ]);
    assert(Boolean(account), 'HTTP confirm did not create account', { accountName, response, executionResult, pendingAfter });
    assert(pendingAfter?.status === 'confirmed', 'pending action was not marked confirmed by HTTP endpoint', { pendingAfter, response, executionResult });
    return { accountId: account.id, pendingStatus: pendingAfter.status, executed: response.executed };
  });

  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(reportPath, safeStringify({ startedAt, finishedAt: new Date(), baseUrl, healthUrl, results }) + '\n', 'utf8');
  console.log(`\nReport: ${reportPath}`);
  const failed = results.filter((item) => item.status === 'failed').length;
  const passed = results.filter((item) => item.status === 'passed').length;
  console.log(`Summary\n  Passed: ${passed}\n  Failed: ${failed}`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => prisma.$disconnect());

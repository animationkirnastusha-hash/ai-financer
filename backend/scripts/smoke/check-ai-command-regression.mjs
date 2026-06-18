import fs from 'node:fs';
import path from 'node:path';
import { createSmokeContext } from './lib/test-context.mjs';
import { requestJson, unwrapArray } from './lib/http-client.mjs';
import { AI_REGRESSION_CASES } from './ai-regression/cases.mjs';
import { actionList, assertCase, lower } from './ai-regression/assertions.mjs';

const MONEY = 'RUB';
const DEFAULT_DELAY_MS = Number(process.env.AI_REGRESSION_DELAY_MS ?? 650);
const RATE_LIMIT_WAIT_MS = Number(process.env.AI_REGRESSION_RATE_LIMIT_WAIT_MS ?? 61_000);
const LIMIT = Number(process.env.AI_REGRESSION_LIMIT ?? 0);
const SOFT = process.env.AI_REGRESSION_SOFT === '1';
const GROUPS = String(process.env.AI_REGRESSION_GROUPS ?? '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fail(message, data) {
  const error = new Error(message);
  error.details = data;
  throw error;
}

async function listAccounts(context) {
  const response = await requestJson(context, '/accounts');
  return unwrapArray(response.payload, 'accounts');
}

async function ensureAccount(context, state, name, type, balance, currency = MONEY) {
  const accounts = await listAccounts(context);
  const existing = accounts.find((account) => lower(account.name) === lower(name));
  if (existing) return existing;

  const response = await requestJson(context, '/accounts', {
    method: 'POST',
    expected: [201],
    body: {
      name,
      type,
      currency,
      balance,
      showInTotalBalance: true,
    },
  });

  const account = response.payload?.account;
  if (!account?.id) fail(`Cannot create account ${name}`, response.payload);
  state.createdAccounts.push(account);
  return account;
}

async function createBaselineTransaction(context, accountId) {
  const response = await requestJson(context, '/transactions', {
    method: 'POST',
    expected: [201],
    body: {
      accountId,
      type: 'expense',
      amount: 111,
      title: 'AI regression baseline',
      description: 'Baseline operation for AI command regression tests',
    },
  });

  const transaction = response.payload?.transaction;
  if (!transaction?.id) fail('Cannot create baseline transaction', response.payload);
  return transaction;
}

function normalizeSettingsForRestore(snapshot) {
  const settings = snapshot?.settings ?? {};
  return {
    preset: settings.preset ?? 'balanced',
    defaultExpenseAccountId: settings.defaultExpenseAccountId ?? null,
    defaultIncomeAccountId: settings.defaultIncomeAccountId ?? null,
    autoConfirmExpenseLimit: settings.autoConfirmExpenseLimit ?? 5000,
    autoConfirmIncomeLimit: settings.autoConfirmIncomeLimit ?? 200000,
    autoConfirmTransferLimit: settings.autoConfirmTransferLimit ?? 0,
    requireConfirmForAccountActions: settings.requireConfirmForAccountActions ?? true,
    companionTone: settings.companionTone ?? 'friendly',
  };
}

async function prepareDeterministicAISettings(context) {
  let previous = null;
  try {
    previous = (await requestJson(context, '/ai-settings')).payload;
  } catch (error) {
    context.log('AI settings snapshot failed', error?.message ?? String(error));
  }

  await requestJson(context, '/ai-settings', {
    method: 'PATCH',
    body: {
      preset: 'strict',
      defaultExpenseAccountId: null,
      defaultIncomeAccountId: null,
      autoConfirmExpenseLimit: 0,
      autoConfirmIncomeLimit: 0,
      autoConfirmTransferLimit: 0,
      requireConfirmForAccountActions: true,
      companionTone: 'calm',
    },
  });

  return previous;
}

async function restoreAISettings(context, snapshot) {
  if (!snapshot) return;
  try {
    await requestJson(context, '/ai-settings', {
      method: 'PATCH',
      body: normalizeSettingsForRestore(snapshot),
    });
  } catch (error) {
    context.log('AI settings restore failed', error?.message ?? String(error));
  }
}

async function cleanup(context, state) {
  if (state.baselineTransactionId) {
    try {
      await requestJson(context, `/transactions/${state.baselineTransactionId}`, {
        method: 'DELETE',
        body: { balanceMode: 'revert' },
      });
    } catch (error) {
      context.log('cleanup baseline transaction failed', error?.message ?? String(error));
    }
  }

  await restoreAISettings(context, state.previousAISettings);

  for (const account of [...state.createdAccounts].reverse()) {
    try {
      await requestJson(context, `/accounts/${account.id}`, { method: 'DELETE' });
    } catch (error) {
      context.log(`cleanup account failed: ${account.name}`, error?.message ?? String(error));
    }
  }
}

function selectScenarios() {
  let scenarios = AI_REGRESSION_CASES;
  if (GROUPS.length) scenarios = scenarios.filter((scenario) => GROUPS.includes(scenario.group));
  if (LIMIT > 0) scenarios = scenarios.slice(0, LIMIT);
  return scenarios;
}

async function parseCommandWithRetry(context, scenario, attempt = 1) {
  try {
    return await requestJson(context, '/ai/parse', {
      method: 'POST',
      body: {
        command: scenario.command,
        execute: false,
        source: 'text',
        idempotencyKey: `ai-regression-${context.suffix}-${scenario.label}`,
      },
    });
  } catch (error) {
    if (error?.details?.status === 429 && attempt <= 3) {
      context.log(`${scenario.label}: rate limited, waiting ${RATE_LIMIT_WAIT_MS}ms`, error.details.payload);
      await sleep(RATE_LIMIT_WAIT_MS);
      return parseCommandWithRetry(context, scenario, attempt + 1);
    }
    throw error;
  }
}

function summarizePayload(payload) {
  return {
    intent: payload?.intent,
    status: payload?.status,
    message: payload?.message,
    requiresConfirmation: payload?.requiresConfirmation,
    clarification: payload?.meta?.clarification ?? payload?.parsed?.clarification ?? null,
    actions: actionList(payload).map((action) => ({ tool: action.tool, input: action.input })),
  };
}

function ensureReportDir() {
  const reportDir = path.resolve(process.cwd(), 'reports', 'ai-regression');
  fs.mkdirSync(reportDir, { recursive: true });
  return reportDir;
}

async function run() {
  if (process.env.SKIP_AI_SMOKE === '1') {
    console.log('[ai-command-regression] skipped by SKIP_AI_SMOKE=1');
    return;
  }

  const context = createSmokeContext('ai-command-regression');
  const scenarios = selectScenarios();
  const state = { createdAccounts: [], baselineTransactionId: null, previousAISettings: null };
  const results = [];
  const startedAt = Date.now();

  context.log(`start: ${context.baseUrl}`);
  context.log('selected scenarios', { count: scenarios.length, groups: GROUPS.length ? GROUPS : 'all', soft: SOFT });

  try {
    const cash = await ensureAccount(context, state, 'Наличка', 'cash', 100000, MONEY);
    const card = await ensureAccount(context, state, 'Карта', 'card', 100000, MONEY);
    await ensureAccount(context, state, 'T-Bank', 'card', 50000, MONEY);
    await ensureAccount(context, state, 'Cash', 'cash', 1000, 'USD');
    const baseline = await createBaselineTransaction(context, cash.id);
    state.baselineTransactionId = baseline.id;
    state.previousAISettings = await prepareDeterministicAISettings(context);

    for (let index = 0; index < scenarios.length; index += 1) {
      const scenario = scenarios[index];
      const number = String(index + 1).padStart(3, '0');
      const started = Date.now();

      try {
        const response = await parseCommandWithRetry(context, scenario);
        const payload = response.payload;
        const failures = [];
        assertCase(payload, scenario, (message, data) => failures.push({ message, data }));

        if (failures.length) {
          results.push({ label: scenario.label, group: scenario.group, command: scenario.command, ok: false, durationMs: Date.now() - started, failures, payload: summarizePayload(payload) });
          console.log(`✕ ${number}/${scenarios.length} ${scenario.label} (${scenario.group})`);
          failures.forEach((item) => console.log(`  - ${item.message}`));
        } else {
          results.push({ label: scenario.label, group: scenario.group, command: scenario.command, ok: true, durationMs: Date.now() - started, payload: summarizePayload(payload) });
          console.log(`✓ ${number}/${scenarios.length} ${scenario.label} (${scenario.group})`);
        }
      } catch (error) {
        results.push({ label: scenario.label, group: scenario.group, command: scenario.command, ok: false, durationMs: Date.now() - started, error: error?.stack || String(error), details: error?.details ?? error?.details });
        console.log(`✕ ${number}/${scenarios.length} ${scenario.label} (${scenario.group})`);
        console.log(`  - ${error?.message ?? String(error)}`);
        if (error?.details) console.log(JSON.stringify(error.details, null, 2));
      }

      if (DEFAULT_DELAY_MS > 0 && index < scenarios.length - 1) await sleep(DEFAULT_DELAY_MS);
    }
  } finally {
    await cleanup(context, state);
  }

  const failed = results.filter((result) => !result.ok);
  const grouped = results.reduce((acc, result) => {
    const current = acc[result.group] ?? { total: 0, failed: 0 };
    current.total += 1;
    if (!result.ok) current.failed += 1;
    acc[result.group] = current;
    return acc;
  }, {});

  const report = {
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    soft: SOFT,
    groups: grouped,
    results,
  };

  const reportPath = path.join(ensureReportDir(), `ai-command-regression-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('\n=== AI command regression summary ===');
  console.log(`Total: ${report.total}`);
  console.log(`Passed: ${report.passed}`);
  console.log(`Failed: ${report.failed}`);
  console.log(`Report: ${path.relative(process.cwd(), reportPath)}`);

  if (failed.length && !SOFT) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});

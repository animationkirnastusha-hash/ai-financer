const MONEY_ACTION_TOOLS = new Set([
  'create_transaction',
  'update_transaction',
  'transfer_money',
  'create_account',
  'update_account',
  'delete_account',
  'delete_accounts',
  'create_goal',
  'update_goal',
  'delete_goal',
  'create_obligation',
  'update_obligation',
  'delete_obligation',
  'mark_obligation_paid',
  'create_spending_limit',
  'update_spending_limit',
  'delete_spending_limit',
]);

export function text(value) {
  return String(value ?? '').trim();
}

export function lower(value) {
  return text(value).toLowerCase().replace(/ё/g, 'е');
}

export function hasCyrillic(value) {
  return /[а-яё]/i.test(text(value));
}

export function hasLatin(value) {
  return /[a-z]/i.test(text(value));
}

export function includesAny(value, needles) {
  const source = lower(value);
  return (Array.isArray(needles) ? needles : [needles]).some((needle) => source.includes(lower(needle)));
}

export function asNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const raw = String(value)
    .replace(/[₽$€]/g, '')
    .replace(/\b(rub|ruble|rubles|руб|рублей|usd|eur|vnd)\b/gi, '')
    .replace(/\s+/g, '')
    .replace(',', '.')
    .trim();
  const multiplier = /к|k/i.test(raw) ? 1000 : 1;
  const normalized = raw.replace(/к|k/gi, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed * multiplier : null;
}

export function actionList(payload) {
  const actions = payload?.parsed?.actions;
  return Array.isArray(actions) ? actions : [];
}

export function firstAction(payload) {
  return actionList(payload)[0] ?? null;
}

export function findAction(payload, expectedTools) {
  const tools = Array.isArray(expectedTools) ? expectedTools : [expectedTools];
  return actionList(payload).find((action) => tools.includes(action?.tool)) ?? null;
}

export function clarification(payload) {
  return payload?.meta?.clarification || payload?.parsed?.clarification || null;
}

export function collectText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(collectText).join(' ');
  if (typeof value === 'object') return Object.values(value).map(collectText).join(' ');
  return '';
}

export function assertDryRun(payload, fail) {
  if (payload?.executed) fail('dry-run response executed a real action', { executed: payload.executed });
  if (payload?.meta?.pendingActionId) fail('dry-run response created a pending action', { pendingActionId: payload.meta.pendingActionId });
  if (payload?.meta?.dryRun !== true) fail('expected meta.dryRun=true', { meta: payload?.meta });
}

export function assertLanguage(payload, language, fail) {
  if (!language) return;
  const message = text(payload?.message);
  if (!message) return;
  if (language === 'en' && hasCyrillic(message)) {
    fail('expected English response message, got Cyrillic text', { message });
  }
  if (language === 'ru' && !hasCyrillic(message) && hasLatin(message)) {
    fail('expected Russian response message, got Latin-only text', { message });
  }
}

export function assertNoMoneyAction(payload, fail) {
  const actions = actionList(payload);
  const moneyActions = actions.filter((action) => MONEY_ACTION_TOOLS.has(action?.tool));
  if (moneyActions.length) fail('expected no money-changing action', { actions: moneyActions });
}

export function assertTitleClean(action, command, fail) {
  const title = text(action?.input?.title ?? action?.input?.name);
  if (!title) return;
  const normalized = lower(title);
  const commandText = lower(command);
  if (/\d/.test(title)) fail('title/name contains amount or digits', { title, action });
  if (normalized.includes('потратил') || normalized.includes('создай') || normalized.includes('руб') || normalized.includes(':')) {
    fail('title/name looks like copied command text', { title, action });
  }
  if (normalized.includes('напит') && normalized.includes('сигар')) {
    fail('title/name copied mixed purchase composition', { title, action });
  }
  if (title.length > 18 && commandText.includes(normalized)) {
    fail('title/name is copied too closely from user command', { title, command });
  }

  const titleTokens = normalized.split(/\s+/).filter((token) => token.length >= 3);
  const commandTokens = new Set(commandText.split(/\s+/).filter((token) => token.length >= 3));
  const covered = titleTokens.filter((token) => commandTokens.has(token)).length;
  if (titleTokens.length >= 3 && covered / titleTokens.length >= 0.9) {
    fail('title/name is copied too closely from user command', { title, command });
  }
}

export function assertCase(payload, scenario, fail) {
  assertDryRun(payload, fail);
  assertLanguage(payload, scenario.expect?.language, fail);

  const expect = scenario.expect ?? {};
  const actions = actionList(payload);

  if (expect.noMoneyAction) assertNoMoneyAction(payload, fail);

  if (expect.actionCount !== undefined && actions.length !== expect.actionCount) {
    fail(`expected ${expect.actionCount} action(s), got ${actions.length}`, { actions });
  }

  if (expect.clarificationField) {
    const fields = Array.isArray(expect.clarificationField) ? expect.clarificationField : [expect.clarificationField];
    const item = clarification(payload);
    if (!item) fail('expected clarification', { payload });
    if (item && !fields.includes(item.field)) {
      fail(`expected clarification field ${fields.join(' or ')}, got ${item.field}`, { clarification: item });
    }
  }

  if (expect.noSilentAccount) {
    const transaction = findAction(payload, 'create_transaction');
    const item = clarification(payload);
    const hasAccountClarification = item && ['account', 'fromAccount', 'paymentAccount'].includes(item.field);
    if (transaction?.input?.account && !hasAccountClarification) {
      fail('command had no account, but AI silently selected an account', { account: transaction.input.account, action: transaction });
    }
  }

  const action = expect.tool ? findAction(payload, expect.tool) : firstAction(payload);
  if (expect.tool && !action) {
    fail(`expected tool ${Array.isArray(expect.tool) ? expect.tool.join(' or ') : expect.tool}`, { actions });
  }

  if (!action) return;

  if (expect.kind && action.input?.kind !== expect.kind) {
    fail(`expected kind ${expect.kind}, got ${action.input?.kind}`, { action });
  }

  if (expect.amount !== undefined) {
    const amountFields = ['amount', 'targetAmount', 'initialBalance', 'monthlyPayment', 'principalAmount', 'currentDebt'];
    const value = asNumber(action.input?.amount ?? action.input?.targetAmount ?? action.input?.initialBalance ?? action.input?.monthlyPayment ?? action.input?.principalAmount ?? action.input?.currentDebt);
    const expectedAmount = Number(expect.amount);
    const matchingAction = actions.find((candidate) => amountFields.some((field) => Math.abs((asNumber(candidate?.input?.[field]) ?? Number.NaN) - expectedAmount) <= 0.01));
    if ((value === null || Math.abs(value - expectedAmount) > 0.01) && !matchingAction) {
      fail(`expected amount ${expect.amount}, got ${value}`, { action, actions });
    }
  }

  if (expect.currency) {
    const currency = lower(action.input?.currency);
    if (currency !== lower(expect.currency)) fail(`expected currency ${expect.currency}, got ${action.input?.currency}`, { action });
  }

  for (const [field, needles] of Object.entries(expect.includes ?? {})) {
    if (!includesAny(action.input?.[field], needles)) {
      fail(`expected ${field} to include ${Array.isArray(needles) ? needles.join(' or ') : needles}`, { action });
    }
  }

  for (const [field, needles] of Object.entries(expect.notIncludes ?? {})) {
    if (includesAny(action.input?.[field], needles)) {
      fail(`expected ${field} not to include ${Array.isArray(needles) ? needles.join(' or ') : needles}`, { action });
    }
  }

  if (expect.textIncludes) {
    const allText = collectText(action.input);
    for (const needles of expect.textIncludes) {
      if (!includesAny(allText, needles)) fail(`expected action text to include ${Array.isArray(needles) ? needles.join(' or ') : needles}`, { action });
    }
  }

  if (expect.textNotIncludes) {
    const allText = collectText(action.input);
    for (const needles of expect.textNotIncludes) {
      if (includesAny(allText, needles)) fail(`expected action text not to include ${Array.isArray(needles) ? needles.join(' or ') : needles}`, { action });
    }
  }

  if (expect.cleanTitle) assertTitleClean(action, scenario.command, fail);

  if (expect.noProductForMixedMerchant) {
    const categoryText = `${action.input?.category ?? ''} ${action.input?.section ?? ''}`;
    if (includesAny(categoryText, ['продукты', 'groceries'])) {
      fail('mixed merchant purchase should not be classified as plain groceries/products', { action });
    }
  }
}

import { prisma } from '../../lib/prisma';
import {
  AIAccountType,
  AIActionPlan,
  AICurrency,
  AIRiskLevel,
  AIToolCall,
  AIValidatedAction,
  AIValidatedPlan,
} from './types';
import { getToolDefinition } from './tools/tool-registry';
import { convertMoney, detectCurrencyInText, normalizeCurrency, normalizeMoneyAmount } from './utils/amount-normalizer';

interface AccountLite {
  id: string;
  name: string;
  type: string;
  currency: string;
  balance: number;
}

type PlannedAccount = { name: string; currency: AICurrency; existingId?: string };

const ACCOUNT_TYPES: AIAccountType[] = ['cash', 'card', 'savings', 'investment'];
const CURRENCIES: AICurrency[] = ['RUB', 'USD', 'EUR', 'VND'];
const AUTO_EXECUTE_EXPENSE_LIMIT = Number(process.env.AI_AUTO_EXECUTE_EXPENSE_LIMIT ?? 5000);

export class AIValidatorService {
  async validate(userId: string, plan: AIActionPlan): Promise<AIValidatedPlan> {
    const [accounts, categories, sections] = await Promise.all([
      prisma.account.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.category.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.section.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    ]);

    const issues: AIValidatedPlan['issues'] = [];
    const actions: AIValidatedAction[] = [];
    const plannedAccounts = new Map<string, PlannedAccount>();

    if (!plan.actions.length) {
      issues.push({ code: 'no_actions', message: 'Не удалось определить действие. Напиши короче: действие, сумма, счёт.' });
    }

    for (const [index, action] of plan.actions.entries()) {
      const definition = getToolDefinition(action.tool);
      if (!definition) {
        issues.push({ code: 'unknown_tool', message: `Неизвестное действие: ${action.tool}`, actionIndex: index });
        continue;
      }

      const input = { ...action.input };
      const userText = this.cleanString(input.__userText);
      const resolved: Record<string, unknown> = {};
      delete input.__userText;

      if (action.tool === 'create_account') {
        const fallbackName = `Счёт ${plannedAccounts.size + accounts.length + 1}`;
        const name = this.cleanEntityName(input.name) || fallbackName;
        const type = this.coerceAccountType(input.type, 'cash') ?? 'cash';
        const currency = this.coerceCurrency(input.currency, userText, 'RUB') ?? 'RUB';
        const initialBalance = normalizeMoneyAmount(input.initialBalance, userText) ?? 0;
        const existing = this.resolveAccount(accounts, name);

        input.name = name;
        input.type = type;
        input.currency = currency;
        input.initialBalance = initialBalance;

        if (existing) {
          resolved.existingAccountId = existing.id;
          resolved.noop = true;
          plannedAccounts.set(this.key(name), { name: existing.name, currency: this.ensureCurrency(existing.currency, currency), existingId: existing.id });
        } else {
          plannedAccounts.set(this.key(name), { name, currency });
        }
      }

      if (action.tool === 'update_account' || action.tool === 'delete_account') {
        const accountName = this.cleanString(input.account || input.name);
        const account = this.resolveAccount(accounts, accountName);
        if (!account) {
          issues.push({
            code: 'account_not_found',
            message: accountName ? `Не нашёл счёт: ${accountName}` : 'Не хватает счёта.',
            actionIndex: index,
            field: 'account',
          });
        } else {
          resolved.accountId = account.id;
        }

        if (action.tool === 'update_account') {
          const type = this.coerceAccountType(input.type, null);
          const currency = this.coerceCurrency(input.currency, userText, null);
          const balance = normalizeMoneyAmount(input.balance, userText);

          if (input.name !== null && input.name !== undefined) input.name = this.cleanEntityName(input.name);
          if (type) input.type = type;
          else delete input.type;
          if (currency) input.currency = currency;
          else delete input.currency;
          if (balance !== null) input.balance = balance;
          else delete input.balance;
        }
      }

      if (action.tool === 'create_transaction') {
        const kind = input.kind === 'income' || input.kind === 'expense' ? input.kind : null;
        const amount = normalizeMoneyAmount(input.amount, userText);
        const accountRef = this.cleanString(input.account)
          || this.lastPlannedAccountName(plannedAccounts)
          || accounts[0]?.name
          || '';

        const account = this.resolveAccount(accounts, accountRef);
        const plannedAccount = plannedAccounts.get(this.key(accountRef));
        const targetCurrency = account ? this.ensureCurrency(account.currency, 'RUB') : plannedAccount?.currency ?? 'RUB';
        const moneyCurrency = this.coerceCurrency(input.currency, userText, targetCurrency) ?? targetCurrency;

        if (!kind) issues.push({ code: 'missing_transaction_kind', message: 'Не указан тип операции: income или expense.', actionIndex: index, field: 'kind' });
        if (!amount) issues.push({ code: 'missing_amount', message: 'Не хватает суммы операции.', actionIndex: index, field: 'amount' });
        if (!account && !plannedAccount) issues.push({ code: 'account_not_found', message: 'Не найден счёт для операции.', actionIndex: index, field: 'account' });

        const category = this.cleanEntityName(input.category) || (kind === 'income' ? 'Доход' : 'Расход');
        const section = this.cleanEntityName(input.section);
        const description = this.cleanEntityName(input.description) || category;

        input.kind = kind ?? 'expense';
        input.amount = amount ?? 0;
        input.account = accountRef || input.account;
        input.currency = moneyCurrency;
        input.category = category;
        input.section = section;
        input.description = description;

        if (account && amount) {
          const amountInAccountCurrency = convertMoney(amount, moneyCurrency, targetCurrency);
          resolved.accountId = account.id;
          resolved.accountCurrency = targetCurrency;
          resolved.amountInAccountCurrency = amountInAccountCurrency;

          if (kind === 'expense' && account.balance < amountInAccountCurrency) {
            issues.push({ code: 'insufficient_funds', message: `Недостаточно средств на счёте ${account.name}: баланс ${account.balance}, нужно ${amountInAccountCurrency}.`, actionIndex: index, field: 'amount' });
          }
        }

        if (!account && plannedAccount && amount) {
          resolved.pendingAccountName = plannedAccount.name;
          resolved.accountCurrency = plannedAccount.currency;
          resolved.amountInAccountCurrency = convertMoney(amount, moneyCurrency, plannedAccount.currency);
          if (plannedAccount.existingId) resolved.accountId = plannedAccount.existingId;
        }

        const existingCategory = category ? this.findByName(categories, category) : null;
        const existingSection = section ? this.findByName(sections, section) : null;
        if (existingCategory) resolved.categoryId = existingCategory.id;
        if (existingSection) resolved.sectionId = existingSection.id;
      }

      if (action.tool === 'transfer_money') {
        const amount = normalizeMoneyAmount(input.amount, userText);
        const fromName = this.cleanString(input.fromAccount);
        const toName = this.cleanString(input.toAccount);
        const from = this.resolveAccount(accounts, fromName);
        const to = this.resolveAccount(accounts, toName);
        const fromCurrency = from ? this.ensureCurrency(from.currency, 'RUB') : 'RUB';
        const moneyCurrency = this.coerceCurrency(input.currency, userText, fromCurrency) ?? fromCurrency;

        if (!amount) issues.push({ code: 'missing_amount', message: 'Не хватает суммы перевода.', actionIndex: index, field: 'amount' });
        if (!from) issues.push({ code: 'from_account_not_found', message: fromName ? `Не нашёл счёт списания: ${fromName}` : 'Не хватает счёта списания.', actionIndex: index, field: 'fromAccount' });
        if (!to) issues.push({ code: 'to_account_not_found', message: toName ? `Не нашёл счёт пополнения: ${toName}` : 'Не хватает счёта пополнения.', actionIndex: index, field: 'toAccount' });
        if (from && to && from.id === to.id) issues.push({ code: 'same_account_transfer', message: 'Нельзя перевести на тот же счёт.', actionIndex: index });

        input.amount = amount ?? 0;
        input.currency = moneyCurrency;
        if (from) resolved.fromAccountId = from.id;
        if (to) resolved.toAccountId = to.id;
        if (from && amount) {
          const amountInFromCurrency = convertMoney(amount, moneyCurrency, fromCurrency);
          resolved.amountInFromCurrency = amountInFromCurrency;
          if (from.balance < amountInFromCurrency) {
            issues.push({ code: 'insufficient_funds', message: `Недостаточно средств на счёте ${from.name}: баланс ${from.balance}, нужно ${amountInFromCurrency}.`, actionIndex: index, field: 'amount' });
          }
        }
      }

      if (action.tool === 'create_category') {
        const name = this.cleanEntityName(input.name);
        if (!name) issues.push({ code: 'missing_category_name', message: 'Не хватает названия категории.', actionIndex: index, field: 'name' });
        input.name = name;
        input.type = input.type === 'income' ? 'income' : 'expense';
        input.section = this.cleanEntityName(input.section);
        const section = input.section ? this.findByName(sections, String(input.section)) : null;
        if (section) resolved.sectionId = section.id;
      }

      if (action.tool === 'create_section') {
        const name = this.cleanEntityName(input.name);
        if (!name) issues.push({ code: 'missing_section_name', message: 'Не хватает названия раздела.', actionIndex: index, field: 'name' });
        input.name = name;
      }

      const riskLevel = definition.risk as AIRiskLevel;
      const requiresConfirmation = this.requiresConfirmation(action.tool, input, riskLevel, Boolean(resolved.noop));
      actions.push({ ...action, input, resolved, riskLevel, requiresConfirmation });
    }

    const maxRisk = this.maxRisk(actions.map((action) => action.riskLevel));

    return {
      ok: issues.length === 0,
      summary: plan.summary || this.buildSummary(actions),
      actions,
      issues,
      riskLevel: maxRisk,
      requiresConfirmation: actions.some((action) => action.requiresConfirmation),
    };
  }

  private requiresConfirmation(tool: string, input: Record<string, unknown>, riskLevel: AIRiskLevel, noop: boolean) {
    if (noop) return false;
    if (tool === 'show_accounts' || tool === 'show_transactions') return false;
    if (tool === 'create_transaction') {
      const amount = Number(input.amount ?? 0);
      if (input.kind === 'expense' && Number.isFinite(amount) && amount > 0 && amount <= AUTO_EXECUTE_EXPENSE_LIMIT) return false;
    }
    return riskLevel !== 'low';
  }

  private coerceAccountType(value: unknown, fallback: AIAccountType | null): AIAccountType | null {
    if (typeof value !== 'string') return fallback;
    const raw = value.trim().toLowerCase();
    return ACCOUNT_TYPES.includes(raw as AIAccountType) ? raw as AIAccountType : fallback;
  }

  private coerceCurrency(value: unknown, contextText: string, fallback: AICurrency | null): AICurrency | null {
    if (typeof value === 'string') {
      const upper = value.trim().toUpperCase();
      if (CURRENCIES.includes(upper as AICurrency)) return upper as AICurrency;
    }

    const fromText = detectCurrencyInText(contextText);
    if (fromText) return fromText;

    return fallback ? normalizeCurrency(value, fallback) : null;
  }

  private ensureCurrency(value: unknown, fallback: AICurrency): AICurrency {
    if (typeof value === 'string') {
      const upper = value.trim().toUpperCase();
      if (CURRENCIES.includes(upper as AICurrency)) return upper as AICurrency;
    }
    return fallback;
  }

  private cleanString(value: unknown) {
    return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  }

  private cleanEntityName(value: unknown) {
    const raw = this.cleanString(value);
    if (!raw) return '';
    return raw.replace(/["'`«»]/g, '').replace(/\s+/g, ' ').trim();
  }

  private key(value: string) {
    return value.trim().toLowerCase();
  }

  private lastPlannedAccountName(plannedAccounts: Map<string, PlannedAccount>) {
    const values = Array.from(plannedAccounts.values());
    return values.length ? values[values.length - 1].name : '';
  }

  private resolveAccount(accounts: AccountLite[], raw: string) {
    const ref = raw.trim().toLowerCase();
    if (!ref) return null;
    return accounts.find((account) => account.id === raw)
      ?? accounts.find((account) => account.name.toLowerCase() === ref)
      ?? accounts.find((account) => account.name.toLowerCase().includes(ref) || ref.includes(account.name.toLowerCase()))
      ?? null;
  }

  private findByName<T extends { name: string }>(items: T[], raw: string) {
    const ref = raw.trim().toLowerCase();
    return items.find((item) => item.name.toLowerCase() === ref)
      ?? items.find((item) => item.name.toLowerCase().includes(ref) || ref.includes(item.name.toLowerCase()))
      ?? null;
  }

  private maxRisk(levels: AIRiskLevel[]): AIRiskLevel {
    if (levels.includes('high')) return 'high';
    if (levels.includes('medium')) return 'medium';
    return 'low';
  }

  private buildSummary(actions: AIToolCall[]) {
    if (actions.length === 0) return 'Не найдено действий для выполнения.';
    if (actions.length === 1) return 'Проверь действие перед выполнением.';
    return `Проверь ${actions.length} действия перед выполнением.`;
  }
}

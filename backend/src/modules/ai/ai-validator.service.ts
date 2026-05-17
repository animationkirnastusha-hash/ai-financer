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
import { AIEntityResolverService } from './ai-entity-resolver.service';

interface AccountLite {
  id: string;
  name: string;
  type: string;
  currency: string;
  balance: number;
}

const ACCOUNT_TYPES: AIAccountType[] = ['cash', 'card', 'savings', 'investment'];
const CURRENCIES: AICurrency[] = ['RUB', 'USD', 'EUR', 'VND'];
const DEFAULT_AUTO_TRANSACTION_LIMIT = 100000;

export class AIValidatorService {
  private readonly entityResolver = new AIEntityResolverService();
  async validate(userId: string, plan: AIActionPlan): Promise<AIValidatedPlan> {
    const [accounts, categories, sections] = await Promise.all([
      prisma.account.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.category.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.section.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    ]);

    const issues: AIValidatedPlan['issues'] = [];
    const actions: AIValidatedAction[] = [];
    const plannedAccounts = new Map<string, { name: string; currency: AICurrency }>();

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
        const type = this.coerceAccountType(input.type, 'cash');
        const currency: AICurrency = this.coerceCurrency(input.currency, userText, 'RUB') ?? 'RUB';
        const initialBalance = normalizeMoneyAmount(input.initialBalance) ?? 0;
        const existingAccount = this.resolveAccount(accounts, name);

        input.name = existingAccount?.name ?? name;
        input.type = type;
        input.currency = existingAccount ? this.ensureCurrency(existingAccount.currency, currency) : currency;
        input.initialBalance = initialBalance;

        if (existingAccount) {
          resolved.existingAccountId = existingAccount.id;
          resolved.accountId = existingAccount.id;
          input.__skipCreate = true;
          plannedAccounts.set(this.key(name), { name: existingAccount.name, currency: this.ensureCurrency(existingAccount.currency, currency) });
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
        const explicitAccountRef = this.cleanString(input.account);
        const plannedAccountRef = this.lastPlannedAccountName(plannedAccounts);
        const shouldAskAccount = !explicitAccountRef && !plannedAccountRef && kind === 'expense' && accounts.length > 1;
        const accountRef = explicitAccountRef
          || plannedAccountRef
          || (shouldAskAccount ? '' : accounts[0]?.name || '');

        const account = this.resolveAccount(accounts, accountRef);
        const plannedAccount = plannedAccounts.get(this.key(accountRef));
        const targetCurrency: AICurrency = account ? this.ensureCurrency(account.currency, 'RUB') : plannedAccount?.currency ?? 'RUB';
        const moneyCurrency = this.coerceCurrency(input.currency, userText, targetCurrency) ?? targetCurrency;

        if (!kind) issues.push({ code: 'missing_transaction_kind', message: 'AI не указал тип операции: income или expense.', actionIndex: index, field: 'kind' });
        if (!amount) issues.push({ code: 'missing_amount', message: 'Не хватает суммы операции.', actionIndex: index, field: 'amount' });
        if (!account && !plannedAccount) {
          if (shouldAskAccount) {
            issues.push({
              code: 'needs_account_clarification',
              message: 'С какого счёта списать расход?',
              actionIndex: index,
              field: 'account',
            });
          } else {
            issues.push({
              code: 'account_not_found',
              message: accountRef ? `Не найден счёт для операции: ${accountRef}` : 'Не найден счёт для операции.',
              actionIndex: index,
              field: 'account',
            });
          }
        }

        const category = this.cleanEntityName(input.category) || this.cleanEntityName(input.description) || (kind === 'income' ? 'Доход' : 'Расход');
        const section = this.cleanEntityName(input.section);
        const description = this.cleanEntityName(input.description) || category;

        input.kind = kind ?? 'expense';
        input.amount = amount ?? 0;
        input.account = accountRef || input.account || null;
        input.currency = moneyCurrency;
        input.category = category;
        input.section = section;
        input.description = description;

        const amountInAccountCurrency = amount ? convertMoney(amount, moneyCurrency, targetCurrency) : 0;

        if (account && amount) {
          resolved.accountId = account.id;
          resolved.accountCurrency = targetCurrency;
          resolved.amountInAccountCurrency = amountInAccountCurrency;

          if (kind === 'expense' && account.balance < amountInAccountCurrency) {
            issues.push({
              code: 'insufficient_funds',
              message: `Недостаточно средств на счёте "${account.name}": баланс ${account.balance}, расход ${amountInAccountCurrency}.`,
              actionIndex: index,
              field: 'amount',
            });
          }
        }

        if (!account && plannedAccount && amount) {
          resolved.pendingAccountName = plannedAccount.name;
          resolved.accountCurrency = plannedAccount.currency;
          resolved.amountInAccountCurrency = convertMoney(amount, moneyCurrency, plannedAccount.currency);
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
        const fromCurrency: AICurrency = from ? this.ensureCurrency(from.currency, 'RUB') : 'RUB';
        const moneyCurrency = this.coerceCurrency(input.currency, userText, fromCurrency) ?? fromCurrency;

        if (!amount) issues.push({ code: 'missing_amount', message: 'Не хватает суммы перевода.', actionIndex: index, field: 'amount' });
        if (!from) issues.push({ code: 'from_account_not_found', message: fromName ? `Не нашёл счёт списания: ${fromName}` : 'Не хватает счёта списания.', actionIndex: index, field: 'fromAccount' });
        if (!to) issues.push({ code: 'to_account_not_found', message: toName ? `Не нашёл счёт пополнения: ${toName}` : 'Не хватает счёта пополнения.', actionIndex: index, field: 'toAccount' });
        if (from && to && from.id === to.id) issues.push({ code: 'same_account_transfer', message: 'Нельзя перевести на тот же счёт.', actionIndex: index });
        if (from && amount && from.balance < convertMoney(amount, moneyCurrency, fromCurrency)) {
          issues.push({ code: 'insufficient_funds', message: `Недостаточно средств на счёте ${from.name}. Баланс: ${from.balance}, нужно: ${convertMoney(amount, moneyCurrency, fromCurrency)}.`, actionIndex: index, field: 'amount' });
        }

        input.amount = amount ?? 0;
        input.currency = moneyCurrency;
        if (from) resolved.fromAccountId = from.id;
        if (to) resolved.toAccountId = to.id;
        if (from && amount) {
          const amountInFromCurrency = convertMoney(amount, moneyCurrency, fromCurrency);
          resolved.amountInFromCurrency = amountInFromCurrency;

          if (from.balance < amountInFromCurrency) {
            issues.push({
              code: 'insufficient_funds',
              message: `Недостаточно средств на счёте "${from.name}": баланс ${from.balance}, перевод ${amountInFromCurrency}.`,
              actionIndex: index,
              field: 'amount',
            });
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
      const requiresConfirmation = this.resolveRequiresConfirmation(action.tool, input, resolved, definition.requiresConfirmation);
      actions.push({ ...action, input, resolved, riskLevel, requiresConfirmation });
    }

    const maxRisk = this.maxRisk(actions.map((action) => action.riskLevel));

    return {
      ok: issues.length === 0,
      summary: this.buildSummary(actions),
      actions,
      issues,
      riskLevel: maxRisk,
      requiresConfirmation: actions.some((action) => action.requiresConfirmation),
    };
  }

  private resolveRequiresConfirmation(tool: string, input: Record<string, unknown>, resolved: Record<string, unknown>, defaultValue: boolean) {
    if (tool === 'show_accounts' || tool === 'show_transactions') return false;

    if (tool === 'create_transaction') {
      const amount = Number(resolved.amountInAccountCurrency ?? input.amount ?? 0);
      const limit = Number(process.env.AI_AUTO_EXECUTE_TRANSACTION_LIMIT ?? DEFAULT_AUTO_TRANSACTION_LIMIT);
      return !(Number.isFinite(amount) && amount > 0 && amount <= limit);
    }

    return defaultValue;
  }

  private ensureCurrency(value: unknown, fallback: AICurrency): AICurrency {
    if (typeof value === 'string') {
      const upper = value.trim().toUpperCase();
      if (CURRENCIES.includes(upper as AICurrency)) return upper as AICurrency;
    }

    return fallback;
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

  private cleanString(value: unknown) {
    return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  }

  private cleanEntityName(value: unknown) {
    const raw = this.cleanString(value);
    if (!raw) return '';
    return raw
      .replace(/["'`«»]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private key(value: string) {
    return value.trim().toLowerCase();
  }

  private lastPlannedAccountName(plannedAccounts: Map<string, { name: string; currency: AICurrency }>) {
    const values = Array.from(plannedAccounts.values());
    return values.length ? values[values.length - 1].name : '';
  }

  private resolveAccount(accounts: AccountLite[], raw: string) {
    const direct = accounts.find((account) => account.id === raw);
    if (direct) return direct;

    return this.entityResolver.resolveAccount(accounts, raw)?.item ?? null;
  }

  private findByName<T extends { id?: string | null; name: string }>(items: T[], raw: string) {
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
    if (actions.length === 0) return 'Нет действий для выполнения.';
    if (actions.length > 1) return `Подготовлено действий: ${actions.length}.`;

    const action = actions[0];
    const input = action.input ?? {};

    if (action.tool === 'create_transaction') {
      const kind = input.kind === 'income' ? 'Доход' : 'Расход';
      const amount = Number(input.amount ?? 0);
      const currency = typeof input.currency === 'string' ? input.currency : 'RUB';
      const description = this.cleanString(input.description || input.category) || 'операция';
      const account = this.cleanString(input.account);
      return `${kind}: ${description} — ${amount} ${currency}${account ? `, счёт: ${account}` : ''}.`;
    }

    if (action.tool === 'create_account') {
      return `Создать счёт: ${this.cleanString(input.name) || 'без названия'}.`;
    }

    if (action.tool === 'transfer_money') {
      return `Перевод: ${input.amount ?? ''} ${input.currency ?? 'RUB'} со счёта ${input.fromAccount ?? '?'} на ${input.toAccount ?? '?'}.`;
    }

    return 'Проверь действие перед выполнением.';
  }
}

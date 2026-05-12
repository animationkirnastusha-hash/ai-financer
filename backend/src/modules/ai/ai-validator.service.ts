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
import {
  convertMoney,
  normalizeCurrency,
  normalizeMoneyAmountFromCandidates,
} from './utils/amount-normalizer';

const ACCOUNT_TYPES: AIAccountType[] = ['cash', 'card', 'savings', 'investment'];
const CURRENCIES: AICurrency[] = ['RUB', 'USD', 'EUR', 'VND'];

interface AccountLite {
  id: string;
  name: string;
  type: string;
  currency: string;
  balance: number;
}

export class AIValidatorService {
  async validate(userId: string, plan: AIActionPlan): Promise<AIValidatedPlan> {
    const [accounts, categories, sections] = await Promise.all([
      prisma.account.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.category.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.section.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    ]);

    const issues: AIValidatedPlan['issues'] = [];
    const actions: AIValidatedAction[] = [];
    let lastCreatedAccountName: string | null = null;

    plan.actions.forEach((action, index) => {
      const definition = getToolDefinition(action.tool);
      if (!definition) {
        issues.push({ code: 'unknown_tool', message: `Неизвестное действие: ${action.tool}`, actionIndex: index });
        return;
      }

      const input = { ...action.input };
      const resolved: Record<string, unknown> = {};

      if (action.tool === 'create_account') {
        const name = this.cleanName(input.name);
        if (!name) issues.push({ code: 'missing_account_name', message: 'Не хватает названия счёта.', actionIndex: index, field: 'name' });

        input.name = name;
        input.type = ACCOUNT_TYPES.includes(input.type as AIAccountType) ? input.type : 'cash';
        input.currency = CURRENCIES.includes(input.currency as AICurrency) ? input.currency : normalizeCurrency(input.currency, 'RUB');
        input.initialBalance = normalizeMoneyAmountFromCandidates(input.initialBalance, input.amountText, input.balance) ?? 0;
        lastCreatedAccountName = name || null;
      }

      if (action.tool === 'update_account' || action.tool === 'delete_account') {
        const account = this.resolveAccount(accounts, this.cleanName(input.account));
        if (!account) issues.push({ code: 'account_not_found', message: `Не нашёл счёт: ${String(input.account ?? '')}`, actionIndex: index, field: 'account' });
        else resolved.accountId = account.id;

        if (action.tool === 'update_account') {
          if (input.name !== null && input.name !== undefined) input.name = this.cleanName(input.name);
          if (input.type !== null && input.type !== undefined && !ACCOUNT_TYPES.includes(input.type as AIAccountType)) delete input.type;
          if (input.currency !== null && input.currency !== undefined && !CURRENCIES.includes(input.currency as AICurrency)) {
            input.currency = normalizeCurrency(input.currency, account ? account.currency as AICurrency : 'RUB');
          }
          if (input.balance !== null && input.balance !== undefined) {
            input.balance = normalizeMoneyAmountFromCandidates(input.balance, input.amountText) ?? undefined;
          }
        }
      }

      if (action.tool === 'create_transaction') {
        const kind = input.kind === 'income' || input.kind === 'expense' ? input.kind : null;
        const amount = normalizeMoneyAmountFromCandidates(input.amount, input.amountText, input.sum, input.value);
        const accountRef = this.cleanName(input.account) || lastCreatedAccountName || (accounts.length === 1 ? accounts[0].name : '');
        const account = this.resolveAccount(accounts, accountRef);
        const usesPendingAccount = !account && lastCreatedAccountName && this.sameName(accountRef, lastCreatedAccountName);

        if (!kind) issues.push({ code: 'missing_transaction_kind', message: 'Не понял: это доход или расход.', actionIndex: index, field: 'kind' });
        if (!amount) issues.push({ code: 'missing_amount', message: 'Не хватает суммы операции.', actionIndex: index, field: 'amount' });
        if (!account && !usesPendingAccount) {
          issues.push({ code: 'account_not_found', message: accountRef ? `Не нашёл счёт: ${accountRef}` : 'Не хватает счёта.', actionIndex: index, field: 'account' });
        }

        input.kind = kind;
        input.amount = amount ?? 0;
        input.account = accountRef;
        input.category = this.cleanName(input.category);
        input.section = this.cleanName(input.section);
        input.description = this.cleanDescription(input.description, kind === 'income' ? 'Пополнение счёта' : 'Расход');

        const accountCurrency = account ? account.currency as AICurrency : normalizeCurrency(input.currency, 'RUB');
        input.currency = normalizeCurrency(input.currency, accountCurrency);

        if (account && amount) {
          resolved.accountId = account.id;
          resolved.accountCurrency = account.currency;
          resolved.amountInAccountCurrency = convertMoney(amount, input.currency as AICurrency, account.currency as AICurrency);
        }

        if (usesPendingAccount && amount) {
          resolved.pendingAccountName = lastCreatedAccountName;
          resolved.accountCurrency = input.currency;
          resolved.amountInAccountCurrency = amount;
        }

        const category = input.category ? this.findByName(categories, String(input.category)) : null;
        const section = input.section ? this.findByName(sections, String(input.section)) : null;
        if (category) resolved.categoryId = category.id;
        if (section) resolved.sectionId = section.id;
      }

      if (action.tool === 'transfer_money') {
        const amount = normalizeMoneyAmountFromCandidates(input.amount, input.amountText, input.sum, input.value);
        const from = this.resolveAccount(accounts, this.cleanName(input.fromAccount));
        const to = this.resolveAccount(accounts, this.cleanName(input.toAccount));

        if (!amount) issues.push({ code: 'missing_amount', message: 'Не хватает суммы перевода.', actionIndex: index, field: 'amount' });
        if (!from) issues.push({ code: 'from_account_not_found', message: 'Не нашёл счёт списания.', actionIndex: index, field: 'fromAccount' });
        if (!to) issues.push({ code: 'to_account_not_found', message: 'Не нашёл счёт пополнения.', actionIndex: index, field: 'toAccount' });
        if (from && to && from.id === to.id) issues.push({ code: 'same_account_transfer', message: 'Нельзя перевести на тот же счёт.', actionIndex: index });

        input.amount = amount ?? 0;
        input.currency = normalizeCurrency(input.currency, from ? from.currency as AICurrency : 'RUB');
        input.description = this.cleanDescription(input.description, 'Перевод между счетами');
        if (from) resolved.fromAccountId = from.id;
        if (to) resolved.toAccountId = to.id;
        if (from && amount) resolved.amountInFromCurrency = convertMoney(amount, input.currency as AICurrency, from.currency as AICurrency);
      }

      if (action.tool === 'create_category') {
        const name = this.cleanName(input.name);
        if (!name) issues.push({ code: 'missing_category_name', message: 'Не хватает названия категории.', actionIndex: index, field: 'name' });
        input.name = name;
        input.type = input.type === 'income' ? 'income' : 'expense';
        input.section = this.cleanName(input.section);
        const section = input.section ? this.findByName(sections, String(input.section)) : null;
        if (section) resolved.sectionId = section.id;
      }

      if (action.tool === 'create_section') {
        const name = this.cleanName(input.name);
        if (!name) issues.push({ code: 'missing_section_name', message: 'Не хватает названия раздела.', actionIndex: index, field: 'name' });
        input.name = name;
      }

      const riskLevel = definition.risk as AIRiskLevel;
      actions.push({ ...action, input, resolved, riskLevel, requiresConfirmation: definition.requiresConfirmation });
    });

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

  private cleanName(value: unknown) {
    if (typeof value !== 'string') return '';
    return value
      .trim()
      .replace(/[«»"]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/^(счет|счёт|account|wallet|card|карта|название|name)\s+/i, '')
      .trim();
  }

  private cleanDescription(value: unknown, fallback: string) {
    return typeof value === 'string' && value.trim()
      ? value.trim().replace(/\s+/g, ' ')
      : fallback;
  }

  private sameName(a: string, b: string) {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
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
    if (actions.length === 1) return 'Проверь действие перед выполнением.';
    return `Проверь ${actions.length} действия перед выполнением.`;
  }
}

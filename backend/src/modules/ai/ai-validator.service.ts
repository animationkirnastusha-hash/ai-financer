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
import { convertMoney, normalizeCurrency, normalizeMoneyAmount } from './utils/amount-normalizer';

const ACCOUNT_TYPES: AIAccountType[] = ['cash', 'card', 'savings', 'investment'];
const CURRENCIES: AICurrency[] = ['RUB', 'USD', 'EUR', 'VND'];

interface AccountLite {
  id: string;
  name: string;
  type: string;
  currency: string;
  balance: number;
}

type CreatedAccountRef = {
  name: string;
  currency: AICurrency;
};

export class AIValidatorService {
  async validate(userId: string, plan: AIActionPlan): Promise<AIValidatedPlan> {
    const [accounts, categories, sections] = await Promise.all([
      prisma.account.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.category.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.section.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    ]);

    const issues: AIValidatedPlan['issues'] = [];
    const actions: AIValidatedAction[] = [];
    let lastCreatedAccount: CreatedAccountRef | null = null;

    plan.actions.forEach((action, index) => {
      const definition = getToolDefinition(action.tool);
      if (!definition) {
        issues.push({ code: 'unknown_tool', message: `Неизвестное действие: ${action.tool}`, actionIndex: index });
        return;
      }

      const input = { ...action.input };
      const resolved: Record<string, unknown> = {};

      if (action.tool === 'create_account') {
        const name = this.cleanEntityName(this.requiredString(input.name));
        if (!name) issues.push({ code: 'missing_account_name', message: 'Не хватает названия счёта.', actionIndex: index, field: 'name' });

        const type = ACCOUNT_TYPES.includes(input.type as AIAccountType) ? input.type as AIAccountType : 'cash';
        const currency = this.resolveCurrency(input.currency, this.requiredString(input.name), 'RUB');
        const initialBalance = normalizeMoneyAmount(input.initialBalance) ?? 0;

        input.name = name;
        input.type = type;
        input.currency = currency;
        input.initialBalance = initialBalance;

        if (name) lastCreatedAccount = { name, currency };
      }

      if (action.tool === 'update_account' || action.tool === 'delete_account') {
        const account = this.resolveAccount(accounts, this.requiredString(input.account));
        if (!account) issues.push({ code: 'account_not_found', message: `Не нашёл счёт: ${String(input.account ?? '')}`, actionIndex: index, field: 'account' });
        else resolved.accountId = account.id;

        if (action.tool === 'update_account') {
          const newName = this.cleanEntityName(this.requiredString(input.name));
          if (newName) input.name = newName;
          else delete input.name;

          if (input.type !== null && input.type !== undefined && !ACCOUNT_TYPES.includes(input.type as AIAccountType)) delete input.type;
          if (input.currency !== null && input.currency !== undefined && !CURRENCIES.includes(input.currency as AICurrency)) delete input.currency;
          if (input.balance !== null && input.balance !== undefined) input.balance = normalizeMoneyAmount(input.balance);
        }
      }

      if (action.tool === 'create_transaction') {
        const kind = input.kind === 'income' || input.kind === 'expense' ? input.kind : null;
        const amount = normalizeMoneyAmount(input.amount);
        const explicitAccountRef = this.requiredString(input.account);
        const accountRef = explicitAccountRef || lastCreatedAccount?.name || (accounts.length === 1 ? accounts[0].name : '');
        const account = this.resolveAccount(accounts, accountRef);
        const pointsToJustCreatedAccount = !account && lastCreatedAccount && this.isSameRef(accountRef, lastCreatedAccount.name);
        const fallbackCurrency = account
          ? account.currency as AICurrency
          : lastCreatedAccount?.currency ?? 'RUB';
        const currency = this.resolveCurrency(input.currency, `${input.amount ?? ''} ${input.description ?? ''}`, fallbackCurrency);

        if (!kind) issues.push({ code: 'missing_transaction_kind', message: 'Не понял: это доход или расход.', actionIndex: index, field: 'kind' });
        if (!amount) issues.push({ code: 'missing_amount', message: 'Не хватает суммы операции.', actionIndex: index, field: 'amount' });
        if (!account && !pointsToJustCreatedAccount) {
          issues.push({
            code: 'account_not_found',
            message: accountRef ? `Не нашёл счёт: ${accountRef}` : 'Не хватает счёта.',
            actionIndex: index,
            field: 'account',
          });
        }

        input.kind = kind;
        input.amount = amount ?? 0;
        input.currency = currency;

        if (account && amount) {
          resolved.accountId = account.id;
          resolved.accountCurrency = account.currency;
          resolved.amountInAccountCurrency = convertMoney(amount, currency, account.currency as AICurrency);
        }

        if (pointsToJustCreatedAccount && lastCreatedAccount && amount) {
          input.account = lastCreatedAccount.name;
          resolved.pendingAccountName = lastCreatedAccount.name;
          resolved.accountCurrency = lastCreatedAccount.currency;
          resolved.amountInAccountCurrency = convertMoney(amount, currency, lastCreatedAccount.currency);
        }

        const categoryName = this.cleanEntityName(this.requiredString(input.category));
        const sectionName = this.cleanEntityName(this.requiredString(input.section));
        input.category = categoryName || null;
        input.section = sectionName || null;

        const category = categoryName ? this.findByName(categories, categoryName) : null;
        const section = sectionName ? this.findByName(sections, sectionName) : null;
        if (category) resolved.categoryId = category.id;
        if (section) resolved.sectionId = section.id;
      }

      if (action.tool === 'transfer_money') {
        const amount = normalizeMoneyAmount(input.amount);
        const from = this.resolveAccount(accounts, this.requiredString(input.fromAccount));
        const to = this.resolveAccount(accounts, this.requiredString(input.toAccount));
        const currency = this.resolveCurrency(input.currency, String(input.amount ?? ''), from ? from.currency as AICurrency : 'RUB');

        if (!amount) issues.push({ code: 'missing_amount', message: 'Не хватает суммы перевода.', actionIndex: index, field: 'amount' });
        if (!from) issues.push({ code: 'from_account_not_found', message: 'Не нашёл счёт списания.', actionIndex: index, field: 'fromAccount' });
        if (!to) issues.push({ code: 'to_account_not_found', message: 'Не нашёл счёт пополнения.', actionIndex: index, field: 'toAccount' });
        if (from && to && from.id === to.id) issues.push({ code: 'same_account_transfer', message: 'Нельзя перевести на тот же счёт.', actionIndex: index });

        input.amount = amount ?? 0;
        input.currency = currency;
        if (from) resolved.fromAccountId = from.id;
        if (to) resolved.toAccountId = to.id;
        if (from && amount) resolved.amountInFromCurrency = convertMoney(amount, currency, from.currency as AICurrency);
      }

      if (action.tool === 'create_category') {
        const name = this.cleanEntityName(this.requiredString(input.name));
        if (!name) issues.push({ code: 'missing_category_name', message: 'Не хватает названия категории.', actionIndex: index, field: 'name' });
        input.name = name;
        input.type = input.type === 'income' ? 'income' : 'expense';
        const sectionName = this.cleanEntityName(this.requiredString(input.section));
        input.section = sectionName || null;
        const section = sectionName ? this.findByName(sections, sectionName) : null;
        if (section) resolved.sectionId = section.id;
      }

      if (action.tool === 'create_section') {
        const name = this.cleanEntityName(this.requiredString(input.name));
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

  private requiredString(value: unknown) {
    return typeof value === 'string' ? value.trim().replace(/[«»"]/g, '').replace(/\s+/g, ' ') : '';
  }

  private cleanEntityName(value: string) {
    return value
      .replace(/[«»"]/g, '')
      .replace(/^(сч[её]т|account|кошел[её]к|wallet|карта|card)\s+/i, '')
      .replace(/^(с\s+названием|названи[еем]|назови\s+(его|её|это)?|named|name\s+it|called)\s+/i, '')
      .replace(/\s+(и|and)\s+(добавь|положи|закинь|пополни|присвой|add|put|top\s*up|deposit)\b.*$/i, '')
      .replace(/\s+(руб|рубл[ьяей]*|₽|usd|доллар[аов]*|dollars?|eur|евро|vnd|dong|đồng)\.?$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private resolveCurrency(value: unknown, text: string, fallback: AICurrency): AICurrency {
    const direct = normalizeCurrency(value, fallback);
    if (typeof value === 'string' && direct !== fallback) return direct;
    return normalizeCurrency(text, fallback);
  }

  private isSameRef(left: string, right: string) {
    return this.normalizeRef(left) === this.normalizeRef(right);
  }

  private normalizeRef(value: string) {
    return value.trim().toLowerCase().replace(/[«»"]/g, '').replace(/\s+/g, ' ');
  }

  private resolveAccount(accounts: AccountLite[], raw: string) {
    const ref = this.normalizeRef(raw);
    if (!ref) return null;
    return accounts.find((account) => account.id === raw)
      ?? accounts.find((account) => this.normalizeRef(account.name) === ref)
      ?? accounts.find((account) => this.normalizeRef(account.name).includes(ref) || ref.includes(this.normalizeRef(account.name)))
      ?? null;
  }

  private findByName<T extends { name: string }>(items: T[], raw: string) {
    const ref = this.normalizeRef(raw);
    return items.find((item) => this.normalizeRef(item.name) === ref)
      ?? items.find((item) => this.normalizeRef(item.name).includes(ref) || ref.includes(this.normalizeRef(item.name)))
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

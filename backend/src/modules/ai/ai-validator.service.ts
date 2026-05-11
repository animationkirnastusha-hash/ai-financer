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
import { convertMoney, extractCurrencyFromText, normalizeCurrency, normalizeMoneyAmount } from './utils/amount-normalizer';

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
    const virtualAccounts = new Map<string, { name: string; currency: AICurrency; type: AIAccountType }>();
    let lastCreatedAccountName: string | null = null;

    plan.actions.forEach((action, index) => {
      const definition = getToolDefinition(action.tool);
      if (!definition) {
        issues.push({ code: 'unknown_tool', message: `Неизвестное действие: ${action.tool}`, actionIndex: index });
        return;
      }

      const input = this.normalizeInput(action.input);
      const resolved: Record<string, unknown> = {};

      if (action.tool === 'create_account') {
        const name = this.cleanName(this.requiredString(input.name));
        if (!name) issues.push({ code: 'missing_account_name', message: 'Не хватает названия счёта.', actionIndex: index, field: 'name' });

        const type = ACCOUNT_TYPES.includes(input.type as AIAccountType) ? input.type as AIAccountType : 'cash';
        const currency = this.resolveCurrency(input.currency, String(input.name ?? ''));
        const initialBalance = normalizeMoneyAmount(input.initialBalance) ?? 0;

        input.name = name;
        input.type = type;
        input.currency = currency;
        input.initialBalance = initialBalance;

        if (name) {
          lastCreatedAccountName = name;
          virtualAccounts.set(name.toLowerCase(), { name, currency, type });
        }
      }

      if (action.tool === 'update_account' || action.tool === 'delete_account') {
        const account = this.resolveAccount(accounts, this.requiredString(input.account));
        if (!account) issues.push({ code: 'account_not_found', message: `Не нашёл счёт: ${String(input.account ?? '')}`, actionIndex: index, field: 'account' });
        else resolved.accountId = account.id;

        if (action.tool === 'update_account') {
          if (input.name !== null && input.name !== undefined) input.name = this.cleanName(this.requiredString(input.name));
          if (input.type !== null && input.type !== undefined && !ACCOUNT_TYPES.includes(input.type as AIAccountType)) delete input.type;
          if (input.currency !== null && input.currency !== undefined) input.currency = this.resolveCurrency(input.currency);
          if (input.balance !== null && input.balance !== undefined) input.balance = normalizeMoneyAmount(input.balance);
        }
      }

      if (action.tool === 'create_transaction') {
        const kind = input.kind === 'income' || input.kind === 'expense' ? input.kind : null;
        const amount = normalizeMoneyAmount(input.amount);
        const rawAccountRef = this.requiredString(input.account) || lastCreatedAccountName || (accounts.length === 1 ? accounts[0].name : '');
        const account = this.resolveAccount(accounts, rawAccountRef);
        const virtualAccount = rawAccountRef ? virtualAccounts.get(rawAccountRef.toLowerCase()) : null;

        if (!kind) issues.push({ code: 'missing_transaction_kind', message: 'Не понял: это доход или расход.', actionIndex: index, field: 'kind' });
        if (!amount) issues.push({ code: 'missing_amount', message: 'Не хватает суммы операции.', actionIndex: index, field: 'amount' });
        if (!account && !virtualAccount) issues.push({ code: 'account_not_found', message: rawAccountRef ? `Не нашёл счёт: ${rawAccountRef}` : 'Не хватает счёта.', actionIndex: index, field: 'account' });

        const accountCurrency = account ? account.currency as AICurrency : virtualAccount?.currency ?? 'RUB';
        const operationCurrency = this.resolveCurrency(input.currency, `${input.description ?? ''} ${input.account ?? ''}`, accountCurrency);

        input.kind = kind;
        input.amount = amount ?? 0;
        input.currency = operationCurrency;
        input.account = rawAccountRef || null;

        if (account && amount) {
          resolved.accountId = account.id;
          resolved.accountCurrency = account.currency;
          resolved.amountInAccountCurrency = convertMoney(amount, operationCurrency, account.currency as AICurrency);
        } else if (virtualAccount && amount) {
          resolved.pendingAccountName = virtualAccount.name;
          resolved.accountCurrency = virtualAccount.currency;
          resolved.amountInAccountCurrency = convertMoney(amount, operationCurrency, virtualAccount.currency);
        }

        const categoryName = this.requiredString(input.category);
        const sectionName = this.requiredString(input.section);
        const category = categoryName ? this.findByName(categories, categoryName) : null;
        const section = sectionName ? this.findByName(sections, sectionName) : null;
        if (category) resolved.categoryId = category.id;
        if (section) resolved.sectionId = section.id;
      }

      if (action.tool === 'transfer_money') {
        const amount = normalizeMoneyAmount(input.amount);
        const from = this.resolveAccount(accounts, this.requiredString(input.fromAccount));
        const to = this.resolveAccount(accounts, this.requiredString(input.toAccount));

        if (!amount) issues.push({ code: 'missing_amount', message: 'Не хватает суммы перевода.', actionIndex: index, field: 'amount' });
        if (!from) issues.push({ code: 'from_account_not_found', message: 'Не нашёл счёт списания.', actionIndex: index, field: 'fromAccount' });
        if (!to) issues.push({ code: 'to_account_not_found', message: 'Не нашёл счёт пополнения.', actionIndex: index, field: 'toAccount' });
        if (from && to && from.id === to.id) issues.push({ code: 'same_account_transfer', message: 'Нельзя перевести на тот же счёт.', actionIndex: index });

        const currency = this.resolveCurrency(input.currency, String(input.description ?? ''), from ? from.currency as AICurrency : 'RUB');
        input.amount = amount ?? 0;
        input.currency = currency;
        if (from) resolved.fromAccountId = from.id;
        if (to) resolved.toAccountId = to.id;
        if (from && amount) resolved.amountInFromCurrency = convertMoney(amount, currency, from.currency as AICurrency);
      }

      if (action.tool === 'create_category') {
        const name = this.cleanName(this.requiredString(input.name));
        if (!name) issues.push({ code: 'missing_category_name', message: 'Не хватает названия категории.', actionIndex: index, field: 'name' });
        input.name = name;
        input.type = input.type === 'income' ? 'income' : 'expense';
        const sectionName = this.requiredString(input.section);
        const section = sectionName ? this.findByName(sections, sectionName) : null;
        if (section) resolved.sectionId = section.id;
      }

      if (action.tool === 'update_category' || action.tool === 'delete_category') {
        const category = this.findByName(categories, this.requiredString(input.category));
        if (!category) issues.push({ code: 'category_not_found', message: `Не нашёл категорию: ${String(input.category ?? '')}`, actionIndex: index, field: 'category' });
        else resolved.categoryId = category.id;

        if (action.tool === 'update_category') {
          if (input.name !== null && input.name !== undefined) input.name = this.cleanName(this.requiredString(input.name));
          const sectionName = this.requiredString(input.section);
          const section = sectionName ? this.findByName(sections, sectionName) : null;
          if (section) resolved.sectionId = section.id;
        }
      }

      if (action.tool === 'create_section') {
        const name = this.cleanName(this.requiredString(input.name));
        if (!name) issues.push({ code: 'missing_section_name', message: 'Не хватает названия раздела.', actionIndex: index, field: 'name' });
        input.name = name;
      }

      if (action.tool === 'update_section' || action.tool === 'delete_section') {
        const section = this.findByName(sections, this.requiredString(input.section));
        if (!section) issues.push({ code: 'section_not_found', message: `Не нашёл раздел: ${String(input.section ?? '')}`, actionIndex: index, field: 'section' });
        else resolved.sectionId = section.id;
        if (action.tool === 'update_section') input.name = this.cleanName(this.requiredString(input.name));
      }

      if (action.tool === 'assign_category_to_section') {
        const category = this.findByName(categories, this.requiredString(input.category));
        const section = this.findByName(sections, this.requiredString(input.section));
        if (!category) issues.push({ code: 'category_not_found', message: `Не нашёл категорию: ${String(input.category ?? '')}`, actionIndex: index, field: 'category' });
        if (!section) issues.push({ code: 'section_not_found', message: `Не нашёл раздел: ${String(input.section ?? '')}`, actionIndex: index, field: 'section' });
        if (category) resolved.categoryId = category.id;
        if (section) resolved.sectionId = section.id;
      }

      if (action.tool === 'show_transactions') {
        input.limit = normalizeMoneyAmount(input.limit) ?? 20;
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

  private normalizeInput(input: Record<string, unknown>): Record<string, unknown> {
    return { ...input };
  }

  private requiredString(value: unknown) {
    return typeof value === 'string' ? value.trim().replace(/[«»"]/g, '').replace(/\s+/g, ' ') : '';
  }

  private cleanName(value: string) {
    return value
      .replace(/\b(с\s+названием|назови\s+его|назови|named|with\s+name|name\s+it)\b/gi, '')
      .replace(/\b(и\s+добавь|и\s+положи|добавь\s+туда|положи\s+туда|deposit|top\s*up|пополнить|пополнение)\b[\s\S]*$/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private resolveCurrency(value: unknown, text = '', fallback: AICurrency = 'RUB'): AICurrency {
    if (typeof value === 'string' && value.trim()) return normalizeCurrency(value, fallback);
    return extractCurrencyFromText(text, fallback) ?? fallback;
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
    if (!ref) return null;
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

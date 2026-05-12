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
import { convertMoney } from './utils/amount-normalizer';
import {
  asCleanString,
  buildActionText,
  cleanAccountName,
  cleanEntityName,
  normalizeAccountCurrency,
  normalizeAccountType,
  normalizeActionCurrency,
  normalizeAmount,
  normalizeKnownAccountType,
  normalizeKnownCurrency,
} from './utils/semantic-normalizer';

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
    const plannedAccounts = new Map<string, { name: string; currency: AICurrency }>();

    plan.actions.forEach((action, index) => {
      const definition = getToolDefinition(action.tool);
      if (!definition) {
        issues.push({ code: 'unknown_tool', message: `Неизвестное действие: ${action.tool}`, actionIndex: index });
        return;
      }

      const input = { ...action.input };
      const commandText = asCleanString(input.__userText);
      const actionText = buildActionText(input, commandText);
      const resolved: Record<string, unknown> = {};

      delete input.__userText;

      if (action.tool === 'create_account') {
        const fallbackName = `Счёт ${plannedAccounts.size + accounts.length + 1}`;
        const name = cleanAccountName(input.name, commandText, fallbackName);
        if (!name) issues.push({ code: 'missing_account_name', message: 'Не хватает названия счёта.', actionIndex: index, field: 'name' });

        const type = normalizeKnownAccountType(input.type) ?? normalizeAccountType(input.type, actionText);
        const currency = normalizeKnownCurrency(input.currency) ?? normalizeAccountCurrency(input.currency, actionText, 'RUB');
        const initialBalance = normalizeAmount(input.initialBalance, actionText) ?? 0;

        input.name = name;
        input.type = type;
        input.currency = currency;
        input.initialBalance = initialBalance;

        if (name) plannedAccounts.set(this.key(name), { name, currency });
      }

      if (action.tool === 'update_account' || action.tool === 'delete_account') {
        const accountName = asCleanString(input.account || input.name);
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
          const type = normalizeKnownAccountType(input.type);
          const currency = normalizeKnownCurrency(input.currency);

          if (input.name !== null && input.name !== undefined) input.name = cleanAccountName(input.name, commandText);
          if (type) input.type = type;
          else delete input.type;
          if (currency) input.currency = currency;
          else delete input.currency;
          if (input.balance !== null && input.balance !== undefined) input.balance = normalizeAmount(input.balance, actionText);
        }
      }

      if (action.tool === 'create_transaction') {
        const kind = input.kind === 'income' || input.kind === 'expense' ? input.kind : this.inferTransactionKind(actionText);
        const amount = normalizeAmount(input.amount, actionText);

        const accountRef = asCleanString(input.account)
          || this.lastPlannedAccountName(plannedAccounts)
          || (accounts.length === 1 ? accounts[0].name : '');

        const account = this.resolveAccount(accounts, accountRef);
        const plannedAccount = plannedAccounts.get(this.key(accountRef));
        const targetCurrency = account ? account.currency as AICurrency : plannedAccount?.currency ?? 'RUB';
        const moneyCurrency = normalizeActionCurrency(input.currency, actionText, targetCurrency);

        if (!kind) issues.push({ code: 'missing_transaction_kind', message: 'Не понял: это доход или расход.', actionIndex: index, field: 'kind' });
        if (!amount) issues.push({ code: 'missing_amount', message: 'Не хватает суммы операции.', actionIndex: index, field: 'amount' });
        if (!account && !plannedAccount) issues.push({ code: 'account_not_found', message: accountRef ? `Не нашёл счёт: ${accountRef}` : 'Не хватает счёта.', actionIndex: index, field: 'account' });

        input.kind = kind;
        input.amount = amount ?? 0;
        input.account = accountRef || input.account;
        input.currency = moneyCurrency;
        input.category = cleanEntityName(input.category);
        input.section = cleanEntityName(input.section);
        input.description = asCleanString(input.description) || (kind === 'income' ? 'Пополнение счёта' : 'Расход');

        if (account && amount) {
          resolved.accountId = account.id;
          resolved.accountCurrency = account.currency;
          resolved.amountInAccountCurrency = convertMoney(amount, moneyCurrency, account.currency as AICurrency);
        }

        if (!account && plannedAccount && amount) {
          resolved.pendingAccountName = plannedAccount.name;
          resolved.accountCurrency = plannedAccount.currency;
          resolved.amountInAccountCurrency = convertMoney(amount, moneyCurrency, plannedAccount.currency);
        }

        const categoryName = asCleanString(input.category);
        const sectionName = asCleanString(input.section);
        const category = categoryName ? this.findByName(categories, categoryName) : null;
        const section = sectionName ? this.findByName(sections, sectionName) : null;
        if (category) resolved.categoryId = category.id;
        if (section) resolved.sectionId = section.id;
      }

      if (action.tool === 'transfer_money') {
        const amount = normalizeAmount(input.amount, actionText);
        const fromName = asCleanString(input.fromAccount);
        const toName = asCleanString(input.toAccount);
        const from = this.resolveAccount(accounts, fromName);
        const to = this.resolveAccount(accounts, toName);
        const fromCurrency = from ? from.currency as AICurrency : 'RUB';
        const moneyCurrency = normalizeActionCurrency(input.currency, actionText, fromCurrency);

        if (!amount) issues.push({ code: 'missing_amount', message: 'Не хватает суммы перевода.', actionIndex: index, field: 'amount' });
        if (!from) issues.push({ code: 'from_account_not_found', message: fromName ? `Не нашёл счёт списания: ${fromName}` : 'Не хватает счёта списания.', actionIndex: index, field: 'fromAccount' });
        if (!to) issues.push({ code: 'to_account_not_found', message: toName ? `Не нашёл счёт пополнения: ${toName}` : 'Не хватает счёта пополнения.', actionIndex: index, field: 'toAccount' });
        if (from && to && from.id === to.id) issues.push({ code: 'same_account_transfer', message: 'Нельзя перевести на тот же счёт.', actionIndex: index });

        input.amount = amount ?? 0;
        input.currency = moneyCurrency;
        if (from) resolved.fromAccountId = from.id;
        if (to) resolved.toAccountId = to.id;
        if (from && amount) resolved.amountInFromCurrency = convertMoney(amount, moneyCurrency, from.currency as AICurrency);
      }

      if (action.tool === 'create_category') {
        const name = cleanEntityName(input.name, commandText);
        if (!name) issues.push({ code: 'missing_category_name', message: 'Не хватает названия категории.', actionIndex: index, field: 'name' });
        input.name = name;
        input.type = input.type === 'income' ? 'income' : 'expense';
        input.section = cleanEntityName(input.section);
        const section = input.section ? this.findByName(sections, String(input.section)) : null;
        if (section) resolved.sectionId = section.id;
      }

      if (action.tool === 'create_section') {
        const name = cleanEntityName(input.name, commandText);
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

  private inferTransactionKind(text: string): 'income' | 'expense' | null {
    const raw = text.toLowerCase();
    if (/полож|попол|закин|добав|депозит|присвой|зачисл|income|deposit|top ?up|add money|put money|salary|зарплат/.test(raw)) return 'income';
    if (/куп|оплат|потрат|расход|spent|spend|paid|buy|bought|payment/.test(raw)) return 'expense';
    return null;
  }

  private key(value: string) {
    return value.trim().toLowerCase();
  }

  private lastPlannedAccountName(plannedAccounts: Map<string, { name: string; currency: AICurrency }>) {
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
    if (actions.length === 1) return 'Проверь действие перед выполнением.';
    return `Проверь ${actions.length} действия перед выполнением.`;
  }
}

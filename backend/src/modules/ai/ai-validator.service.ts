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
import { aiRiskPolicyService } from './ai-risk-policy.service';

interface AccountLite {
  id: string;
  name: string;
  type: string;
  currency: string;
  balance: number;
}

interface TransactionLite {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  sectionId: string | null;
  date: Date;
  createdAt: Date;
  account?: { id: string; name: string; currency: string } | null;
  toAccount?: { id: string; name: string; currency: string } | null;
  category?: { id: string; name: string; type: string; sectionId?: string | null } | null;
  section?: { id: string; name: string } | null;
}

interface LoanLite {
  id: string;
  title: string;
  type: string;
  currency: string;
  monthlyPayment: number;
  currentDebt: number;
  status: string;
  nextPaymentDate: Date | null;
  accountId: string | null;
}

interface SpendingLimitLite {
  id: string;
  targetType: string;
  accountId: string | null;
  categoryId: string | null;
  amount: number;
  period: string;
  isActive: boolean;
  account?: { id: string; name: string } | null;
  category?: { id: string; name: string; type: string } | null;
}

const ACCOUNT_TYPES: AIAccountType[] = ['cash', 'card', 'savings', 'investment'];
const CURRENCIES: AICurrency[] = ['RUB', 'USD', 'EUR', 'VND'];
const DEFAULT_AUTO_TRANSACTION_LIMIT = 100000;
const OBLIGATION_TYPES = ['loan', 'mortgage', 'installment', 'subscription', 'other'];
const OBLIGATION_STATUSES = ['active', 'paused', 'closed'];
const SPENDING_LIMIT_PERIODS = ['daily', 'weekly', 'monthly'];
const SPENDING_LIMIT_TARGET_TYPES = ['account', 'category', 'total'];

export class AIValidatorService {
  private readonly entityResolver = new AIEntityResolverService();
  async validate(userId: string, plan: AIActionPlan): Promise<AIValidatedPlan> {
    const [accounts, categories, sections, goals, loans, spendingLimits, transactions, aiSettings] = await Promise.all([
      prisma.account.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.category.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.section.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.goal.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.loan.findMany({ where: { userId }, orderBy: [{ status: 'asc' }, { nextPaymentDate: 'asc' }, { createdAt: 'asc' }] }),
      prisma.spendingLimit.findMany({ where: { userId }, include: { account: { select: { id: true, name: true } }, category: { select: { id: true, name: true, type: true } } }, orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }] }),
      prisma.transaction.findMany({
        where: { userId },
        include: {
          account: { select: { id: true, name: true, currency: true } },
          toAccount: { select: { id: true, name: true, currency: true } },
          category: { select: { id: true, name: true, type: true, sectionId: true } },
          section: { select: { id: true, name: true } },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 30,
      }),
      prisma.userAISettings.upsert({
        where: { userId },
        create: { userId, autoConfirmExpenseLimit: 5000, autoConfirmIncomeLimit: 200000 },
        update: {},
      }),
    ]);


    const issues: AIValidatedPlan['issues'] = [];
    let actions: AIValidatedAction[] = [];
    const plannedAccounts = new Map<string, { name: string; currency: AICurrency }>();

    for (const [index, action] of plan.actions.entries()) {
      const definition = getToolDefinition(action.tool);
      if (!definition) {
        issues.push({ code: 'unknown_tool', message: `Неизвестное действие: ${action.tool}`, actionIndex: index });
        continue;
      }

      const input = { ...action.input };
      const resolved: Record<string, unknown> = {};
      delete input.__userText;

    if (action.tool === 'create_account') {
        const fallbackName = `Счёт ${plannedAccounts.size + accounts.length + 1}`;
        const name = this.cleanEntityName(input.name) || fallbackName;
        const type = this.coerceAccountType(input.type, 'cash');
        const currency: AICurrency = this.coerceCurrency(input.currency, '', 'RUB') ?? 'RUB';
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
          const currency = this.coerceCurrency(input.currency, '', null);
          const balance = normalizeMoneyAmount(input.balance);

          if (input.name !== null && input.name !== undefined) input.name = this.cleanEntityName(input.name);
          if (type) input.type = type;
          else delete input.type;
          if (currency) input.currency = currency;
          else delete input.currency;
          if (balance !== null) input.balance = balance;
          else delete input.balance;
        }
      }

      if (action.tool === 'delete_accounts') {
        const scope = this.cleanString(input.scope) === 'selected' ? 'selected' : 'all';
        input.scope = scope;

        if (scope === 'selected') {
          const rawAccounts = Array.isArray(input.accounts) ? input.accounts : [];
          const accountIds = rawAccounts
            .map((value) => this.resolveAccount(accounts, this.cleanString(value))?.id)
            .filter((value): value is string => Boolean(value));

          if (accountIds.length === 0) {
            issues.push({ code: 'accounts_not_found', message: 'Не нашёл счета для удаления.', actionIndex: index, field: 'accounts' });
          }

          resolved.accountIds = accountIds;
          input.accounts = rawAccounts.map((value) => this.cleanString(value)).filter(Boolean);
        } else {
          if (accounts.length === 0) issues.push({ code: 'no_accounts', message: 'Счета уже отсутствуют.', actionIndex: index, field: 'accounts' });
          resolved.accountIds = accounts.map((account) => account.id);
          input.accounts = accounts.map((account) => account.name);
        }
      }

      if (action.tool === 'set_primary_account') {
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
          input.account = account.name;
        }

        const scope = this.cleanString(input.scope);
        input.scope = scope === 'expense' || scope === 'income' || scope === 'both' ? scope : 'both';
      }

      if (action.tool === 'create_transaction') {
        const kind = input.kind === 'income' || input.kind === 'expense' ? input.kind : null;
        const amount = normalizeMoneyAmount(input.amount);
        const explicitAccountRef = this.cleanString(input.account);
        const plannedAccountRef = this.lastPlannedAccountName(plannedAccounts);
        const defaultAccount = this.resolveDefaultTransactionAccount(accounts, kind, aiSettings);
        const shouldAskAccount = !explicitAccountRef && !plannedAccountRef && !defaultAccount && kind === 'expense' && accounts.length > 0;
        const accountRef = explicitAccountRef
          || plannedAccountRef
          || (defaultAccount?.name ?? '')
          || (shouldAskAccount ? '' : accounts[0]?.name || '');

        const account = this.resolveAccount(accounts, accountRef) ?? defaultAccount;
        const plannedAccount = plannedAccounts.get(this.key(accountRef));
        const targetCurrency: AICurrency = account ? this.ensureCurrency(account.currency, 'RUB') : plannedAccount?.currency ?? 'RUB';
        const moneyCurrency = this.coerceCurrency(input.currency, '', targetCurrency) ?? targetCurrency;

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

        const rawCategory = this.cleanEntityName(input.category);
        const rawSection = this.cleanEntityName(input.section);
        const rawDescription = this.cleanEntityName(input.description);

        input.kind = kind ?? 'expense';
        input.amount = amount ?? 0;
        input.account = accountRef || input.account || null;
        input.currency = moneyCurrency;
        input.category = rawCategory || null;
        input.section = rawSection || null;
        input.description = rawDescription || rawCategory || (kind === 'income' ? 'Доход' : 'Расход');

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

        const existingCategory = rawCategory ? this.findByName(categories, rawCategory) : null;
        const existingSection = rawSection ? this.findByName(sections, rawSection) : null;
        if (existingCategory) {
          resolved.categoryId = existingCategory.id;
          if (typeof existingCategory.sectionId === 'string') resolved.sectionId = existingCategory.sectionId;
        }
        if (existingSection) resolved.sectionId = existingSection.id;
      }

      if (action.tool === 'update_transaction') {
        const transaction = this.resolveTransaction(transactions as TransactionLite[], input);
        if (!transaction) {
          issues.push({
            code: 'transaction_not_found',
            message: 'Не нашёл операцию для изменения.',
            actionIndex: index,
            field: 'transaction',
          });
        } else {
          resolved.transactionId = transaction.id;
          input.transaction = this.transactionLabel(transaction);
        }

        const nextKind = this.cleanString(input.kind || input.type).toLowerCase();
        if (nextKind === 'income' || nextKind === 'expense' || nextKind === 'transfer') input.kind = nextKind;
        else delete input.kind;

        const amount = normalizeMoneyAmount(input.amount);
        if (amount !== null) input.amount = amount;
        else delete input.amount;

        const accountName = this.cleanString(input.account);
        if (accountName) {
          const account = this.resolveAccount(accounts, accountName);
          if (!account) {
            issues.push({ code: 'account_not_found', message: `Не нашёл счёт: ${accountName}`, actionIndex: index, field: 'account' });
          } else {
            resolved.accountId = account.id;
            input.account = account.name;
          }
        } else {
          delete input.account;
        }

        const toAccountName = this.cleanString(input.toAccount);
        if (toAccountName) {
          const toAccount = this.resolveAccount(accounts, toAccountName);
          if (!toAccount) {
            issues.push({ code: 'to_account_not_found', message: `Не нашёл счёт пополнения: ${toAccountName}`, actionIndex: index, field: 'toAccount' });
          } else {
            resolved.toAccountId = toAccount.id;
            input.toAccount = toAccount.name;
          }
        } else {
          delete input.toAccount;
        }

        const categoryName = this.cleanEntityName(input.category);
        if (categoryName) {
          input.category = categoryName;
          const category = this.findByName(categories, categoryName);
          if (category) {
            resolved.categoryId = category.id;
            if (typeof category.sectionId === 'string') resolved.sectionId = category.sectionId;
          }
        } else {
          delete input.category;
        }

        const sectionName = this.cleanEntityName(input.section);
        if (sectionName) {
          input.section = sectionName;
          const section = this.findByName(sections, sectionName);
          if (section) resolved.sectionId = section.id;
        } else {
          delete input.section;
        }

        if (input.description !== null && input.description !== undefined) input.description = this.cleanEntityName(input.description);
        else delete input.description;

        const currency = this.coerceCurrency(input.currency, '', null);
        if (currency) input.currency = currency;
        else delete input.currency;

        if (input.date !== null && input.date !== undefined) input.date = this.cleanString(input.date);
        else delete input.date;
      }

      if (action.tool === 'transfer_money') {
        const amount = normalizeMoneyAmount(input.amount);
        const fromName = this.cleanString(input.fromAccount);
        const toName = this.cleanString(input.toAccount);
        const from = this.resolveAccount(accounts, fromName);
        const to = this.resolveAccount(accounts, toName);
        const fromCurrency: AICurrency = from ? this.ensureCurrency(from.currency, 'RUB') : 'RUB';
        const moneyCurrency = this.coerceCurrency(input.currency, '', fromCurrency) ?? fromCurrency;

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


      if (action.tool === 'show_ai_settings') {
        // No validation needed.
      }

      if (action.tool === 'update_ai_settings') {
        const defaultExpenseAccount = this.cleanString(input.defaultExpenseAccount);
        const defaultIncomeAccount = this.cleanString(input.defaultIncomeAccount);
        const expenseAccount = defaultExpenseAccount ? this.resolveAccount(accounts, defaultExpenseAccount) : null;
        const incomeAccount = defaultIncomeAccount ? this.resolveAccount(accounts, defaultIncomeAccount) : null;

        if (defaultExpenseAccount && !expenseAccount) {
          issues.push({ code: 'account_not_found', message: `Не нашёл счёт для расходов: ${defaultExpenseAccount}`, actionIndex: index, field: 'defaultExpenseAccount' });
        }

        if (defaultIncomeAccount && !incomeAccount) {
          issues.push({ code: 'account_not_found', message: `Не нашёл счёт для доходов: ${defaultIncomeAccount}`, actionIndex: index, field: 'defaultIncomeAccount' });
        }

        if (expenseAccount) resolved.defaultExpenseAccountId = expenseAccount.id;
        if (incomeAccount) resolved.defaultIncomeAccountId = incomeAccount.id;

        const expenseLimit = this.optionalMoneyLimit(input.autoConfirmExpenseLimit);
        const incomeLimit = this.optionalMoneyLimit(input.autoConfirmIncomeLimit);
        const transferLimit = this.optionalMoneyLimit(input.autoConfirmTransferLimit);

        if (expenseLimit !== null) input.autoConfirmExpenseLimit = expenseLimit;
        else delete input.autoConfirmExpenseLimit;

        if (incomeLimit !== null) input.autoConfirmIncomeLimit = incomeLimit;
        else delete input.autoConfirmIncomeLimit;

        if (transferLimit !== null) input.autoConfirmTransferLimit = transferLimit;
        else delete input.autoConfirmTransferLimit;

        if (input.requireConfirmForAccountActions !== null && input.requireConfirmForAccountActions !== undefined) {
          input.requireConfirmForAccountActions = Boolean(input.requireConfirmForAccountActions);
        } else {
          delete input.requireConfirmForAccountActions;
        }

        const tone = this.cleanString(input.companionTone).toLowerCase();
        if (tone && ['calm', 'friendly', 'strict', 'coach'].includes(tone)) input.companionTone = tone;
        else delete input.companionTone;
      }

      if (action.tool === 'apply_ai_settings_preset') {
        const preset = this.cleanString(input.preset).toLowerCase();
        if (!['strict', 'balanced', 'simple'].includes(preset)) {
          issues.push({ code: 'invalid_preset', message: 'Неизвестный режим настроек. Доступно: strict, balanced, simple.', actionIndex: index, field: 'preset' });
        } else {
          input.preset = preset;
        }
      }

      if (action.tool === 'update_onboarding_state') {
        const status = this.cleanString(input.status).toLowerCase();
        if (status && !['not_started', 'active', 'completed'].includes(status)) {
          issues.push({ code: 'invalid_onboarding_status', message: 'Некорректный статус обучения.', actionIndex: index, field: 'status' });
        } else if (status) {
          input.status = status;
        } else {
          delete input.status;
        }

        if (input.currentStep !== null && input.currentStep !== undefined) input.currentStep = this.cleanString(input.currentStep);
        else delete input.currentStep;

        if (input.skipped !== null && input.skipped !== undefined) input.skipped = Boolean(input.skipped);
        else delete input.skipped;
      }

      if (action.tool === 'restart_onboarding') {
        // No validation needed.
      }


      if (action.tool === 'query_analytics') {
        input.period = ['today', 'week', 'month', 'year', 'all'].includes(this.cleanString(input.period)) ? this.cleanString(input.period) : 'month';
        input.metric = ['summary', 'spending', 'income', 'top_categories', 'accounts', 'cashflow'].includes(this.cleanString(input.metric)) ? this.cleanString(input.metric) : 'summary';
        const limit = Number(input.limit ?? 5);
        input.limit = Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), 20) : 5;
      }

      if (action.tool === 'undo_last_action') {
        input.target = this.cleanString(input.target) || 'last';
      }

      if (action.tool === 'show_companion_reactions') {
        const limit = Number(input.limit ?? 10);
        input.limit = Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), 50) : 10;
        input.onlyUnseen = Boolean(input.onlyUnseen ?? false);
      }

      if (action.tool === 'mark_companion_reactions_seen') {
        // No validation needed.
      }

      if (action.tool === 'show_premium_capabilities') {
        // No validation needed.
      }



      if (action.tool === 'show_obligations') {
        const status = this.cleanString(input.status).toLowerCase();
        input.status = status && ['active', 'paused', 'closed', 'all'].includes(status) ? status : 'active';
      }

      if (action.tool === 'create_obligation') {
        const title = this.cleanEntityName(input.title || input.name || input.obligation);
        const type = this.normalizeObligationType(input.type);
        const principalAmount = normalizeMoneyAmount(input.principalAmount || input.amount) ?? 0;
        const currentDebt = normalizeMoneyAmount(input.currentDebt) ?? principalAmount;
        const monthlyPayment = normalizeMoneyAmount(input.monthlyPayment || input.payment) ?? 0;
        const currency = this.coerceCurrency(input.currency, '', 'RUB') ?? 'RUB';
        const accountName = this.cleanString(input.account);
        const account = accountName ? this.resolveAccount(accounts, accountName) : null;
        const paymentDay = this.optionalDay(input.paymentDay);
        const reminderDaysBefore = this.optionalReminderDays(input.reminderDaysBefore, 1);
        const nextPaymentDate = this.optionalDate(input.nextPaymentDate);

        if (!title) issues.push({ code: 'missing_obligation_title', message: 'Не хватает названия обязательства.', actionIndex: index, field: 'title' });
        if (accountName && !account) issues.push({ code: 'obligation_account_not_found', message: `Не нашёл счёт списания: ${accountName}`, actionIndex: index, field: 'account' });
        if (!monthlyPayment && type !== 'other') issues.push({ code: 'missing_obligation_payment', message: 'Не хватает ежемесячного платежа.', actionIndex: index, field: 'monthlyPayment' });

        input.title = title;
        input.type = type;
        input.principalAmount = principalAmount;
        input.currentDebt = currentDebt;
        input.monthlyPayment = monthlyPayment;
        input.currency = currency;
        input.creditor = this.cleanEntityName(input.creditor);
        input.interestRate = input.interestRate === null || input.interestRate === undefined || input.interestRate === '' ? null : Number(input.interestRate);
        input.termMonths = this.optionalPositiveInteger(input.termMonths);
        input.paidMonths = this.optionalNonNegativeInteger(input.paidMonths, 0);
        input.paymentDay = paymentDay;
        input.nextPaymentDate = nextPaymentDate ? nextPaymentDate.toISOString() : null;
        input.reminderDaysBefore = reminderDaysBefore;
        input.account = account?.name ?? null;
        input.autoCreateExpense = Boolean(input.autoCreateExpense ?? false);
        input.note = this.cleanEntityName(input.note);
        if (account) resolved.accountId = account.id;
      }

      if (action.tool === 'update_obligation' || action.tool === 'delete_obligation' || action.tool === 'mark_obligation_paid') {
        const obligationName = this.cleanString(input.obligation || input.title || input.name);
        const obligation = this.resolveLoan(loans as LoanLite[], obligationName);
        if (!obligation) {
          issues.push({ code: 'obligation_not_found', message: obligationName ? `Не нашёл обязательство: ${obligationName}` : 'Не хватает обязательства.', actionIndex: index, field: 'obligation' });
        } else {
          resolved.loanId = obligation.id;
          input.obligation = obligation.title;
        }

        if (action.tool === 'update_obligation') {
          const title = this.cleanEntityName(input.title);
          const type = this.cleanString(input.type).toLowerCase();
          const principalAmount = normalizeMoneyAmount(input.principalAmount || input.amount);
          const currentDebt = normalizeMoneyAmount(input.currentDebt);
          const monthlyPayment = normalizeMoneyAmount(input.monthlyPayment || input.payment);
          const accountName = this.cleanString(input.account);
          const account = accountName ? this.resolveAccount(accounts, accountName) : null;
          const status = this.cleanString(input.status).toLowerCase();
          const currency = this.coerceCurrency(input.currency, '', null);
          const nextPaymentDate = this.optionalDate(input.nextPaymentDate);

          if (title) input.title = title; else delete input.title;
          if (OBLIGATION_TYPES.includes(type)) input.type = type; else delete input.type;
          if (input.creditor !== undefined) input.creditor = this.cleanEntityName(input.creditor); else delete input.creditor;
          if (principalAmount !== null) input.principalAmount = principalAmount; else delete input.principalAmount;
          if (currentDebt !== null) input.currentDebt = currentDebt; else delete input.currentDebt;
          if (monthlyPayment !== null) input.monthlyPayment = monthlyPayment; else delete input.monthlyPayment;
          if (currency) input.currency = currency; else delete input.currency;
          if (input.interestRate !== undefined) input.interestRate = input.interestRate === null || input.interestRate === '' ? null : Number(input.interestRate); else delete input.interestRate;
          if (input.termMonths !== undefined) input.termMonths = this.optionalPositiveInteger(input.termMonths); else delete input.termMonths;
          if (input.paidMonths !== undefined) input.paidMonths = this.optionalNonNegativeInteger(input.paidMonths, 0); else delete input.paidMonths;
          if (input.paymentDay !== undefined) input.paymentDay = this.optionalDay(input.paymentDay); else delete input.paymentDay;
          if (input.nextPaymentDate !== undefined) input.nextPaymentDate = nextPaymentDate ? nextPaymentDate.toISOString() : null; else delete input.nextPaymentDate;
          if (input.reminderDaysBefore !== undefined) input.reminderDaysBefore = this.optionalReminderDays(input.reminderDaysBefore, 1); else delete input.reminderDaysBefore;
          if (input.account !== undefined) {
            if (accountName && !account) issues.push({ code: 'obligation_account_not_found', message: `Не нашёл счёт списания: ${accountName}`, actionIndex: index, field: 'account' });
            input.account = account?.name ?? null;
            if (account) resolved.accountId = account.id;
          } else {
            delete input.account;
          }
          if (input.autoCreateExpense !== undefined) input.autoCreateExpense = Boolean(input.autoCreateExpense); else delete input.autoCreateExpense;
          if (OBLIGATION_STATUSES.includes(status)) input.status = status; else delete input.status;
          if (input.note !== undefined) input.note = this.cleanEntityName(input.note); else delete input.note;
        }

        if (action.tool === 'mark_obligation_paid') {
          const amount = normalizeMoneyAmount(input.amount);
          const accountName = this.cleanString(input.account);
          const account = accountName ? this.resolveAccount(accounts, accountName) : null;
          const paidAt = this.optionalDate(input.paidAt);

          if (amount !== null) input.amount = amount; else delete input.amount;
          if (accountName && !account) issues.push({ code: 'obligation_account_not_found', message: `Не нашёл счёт списания: ${accountName}`, actionIndex: index, field: 'account' });
          if (account) resolved.accountId = account.id;
          input.account = account?.name ?? null;
          if (paidAt) input.paidAt = paidAt.toISOString(); else delete input.paidAt;
          if (input.createExpense !== undefined) input.createExpense = Boolean(input.createExpense); else delete input.createExpense;
          if (input.note !== undefined) input.note = this.cleanEntityName(input.note); else delete input.note;
        }
      }

      if (action.tool === 'create_obligation_reminder') {
        const obligationName = this.cleanString(input.obligation || input.loan);
        const obligation = obligationName ? this.resolveLoan(loans as LoanLite[], obligationName) : null;
        if (obligationName && !obligation) issues.push({ code: 'obligation_not_found', message: `Не нашёл обязательство: ${obligationName}`, actionIndex: index, field: 'obligation' });
        if (obligation) {
          resolved.loanId = obligation.id;
          input.obligation = obligation.title;
        } else {
          input.obligation = null;
        }

        const title = this.cleanEntityName(input.title) || (obligation ? `Напоминание: ${obligation.title}` : 'Напоминание');
        const dueDate = this.optionalDate(input.dueDate) ?? (obligation?.nextPaymentDate ?? null);
        const remindAt = this.optionalDate(input.remindAt) ?? dueDate;
        if (!dueDate) issues.push({ code: 'missing_reminder_date', message: 'Не хватает даты напоминания.', actionIndex: index, field: 'dueDate' });

        input.title = title;
        input.message = this.cleanEntityName(input.message) || title;
        input.dueDate = dueDate ? dueDate.toISOString() : null;
        input.remindAt = remindAt ? remindAt.toISOString() : null;
        const channel = this.cleanString(input.channel).toLowerCase();
        input.channel = ['app', 'bot', 'both'].includes(channel) ? channel : 'app';
      }

      if (action.tool === 'show_spending_limits') {
        // No validation needed.
      }

      if (action.tool === 'create_spending_limit') {
        const targetType = this.normalizeSpendingLimitTargetType(input.targetType, input);
        const amount = normalizeMoneyAmount(input.amount);
        const period = this.normalizeSpendingLimitPeriod(input.period);
        const notifyAt = this.optionalPercent(input.notifyAt, 80);

        if (!amount) issues.push({ code: 'missing_spending_limit_amount', message: 'Не хватает суммы лимита.', actionIndex: index, field: 'amount' });

        input.targetType = targetType;
        input.amount = amount ?? 0;
        input.period = period;
        input.notifyAt = notifyAt;

        if (targetType === 'account') {
          const accountName = this.cleanString(input.account || input.target || input.limit);
          const account = this.resolveAccount(accounts, accountName);
          if (!account) {
            issues.push({ code: 'limit_account_not_found', message: accountName ? `Не нашёл счёт для лимита: ${accountName}` : 'Не хватает счёта для лимита.', actionIndex: index, field: 'account' });
          } else {
            resolved.accountId = account.id;
            input.account = account.name;
          }
          input.category = null;
        }

        if (targetType === 'category') {
          const categoryName = this.cleanEntityName(input.category || input.target || input.limit);
          const category = this.findByName(categories.filter((item) => item.type === 'expense'), categoryName);
          if (!category) {
            issues.push({ code: 'limit_category_not_found', message: categoryName ? `Не нашёл категорию расходов для лимита: ${categoryName}` : 'Не хватает категории для лимита.', actionIndex: index, field: 'category' });
          } else {
            resolved.categoryId = category.id;
            input.category = category.name;
          }
          input.account = null;
        }

        if (targetType === 'total') {
          input.account = null;
          input.category = null;
        }
      }

      if (action.tool === 'update_spending_limit' || action.tool === 'delete_spending_limit') {
        const targetType = this.normalizeSpendingLimitTargetType(input.targetType, input, true);
        const limit = this.resolveSpendingLimit(spendingLimits as SpendingLimitLite[], this.cleanString(input.limit), targetType, this.cleanString(input.account), this.cleanEntityName(input.category));

        if (!limit) {
          issues.push({ code: 'spending_limit_not_found', message: 'Не нашёл лимит для изменения.', actionIndex: index, field: 'spending_limit' });
        } else {
          resolved.spendingLimitId = limit.id;
          input.limit = this.spendingLimitLabel(limit);
        }

        if (action.tool === 'update_spending_limit') {
          const amount = normalizeMoneyAmount(input.amount);
          if (amount !== null) input.amount = amount; else delete input.amount;
          if (input.period !== undefined && input.period !== null && input.period !== '') input.period = this.normalizeSpendingLimitPeriod(input.period); else delete input.period;
          if (input.notifyAt !== undefined && input.notifyAt !== null && input.notifyAt !== '') input.notifyAt = this.optionalPercent(input.notifyAt, 80); else delete input.notifyAt;
          if (input.isActive !== undefined && input.isActive !== null) input.isActive = Boolean(input.isActive); else delete input.isActive;

          if (targetType) input.targetType = targetType; else delete input.targetType;
          const accountName = this.cleanString(input.account);
          if (accountName) {
            const account = this.resolveAccount(accounts, accountName);
            if (!account) issues.push({ code: 'limit_account_not_found', message: `Не нашёл счёт для лимита: ${accountName}`, actionIndex: index, field: 'account' });
            else { resolved.accountId = account.id; input.account = account.name; input.targetType = 'account'; }
          } else {
            delete input.account;
          }

          const categoryName = this.cleanEntityName(input.category);
          if (categoryName) {
            const category = this.findByName(categories.filter((item) => item.type === 'expense'), categoryName);
            if (!category) issues.push({ code: 'limit_category_not_found', message: `Не нашёл категорию расходов для лимита: ${categoryName}`, actionIndex: index, field: 'category' });
            else { resolved.categoryId = category.id; input.category = category.name; input.targetType = 'category'; }
          } else {
            delete input.category;
          }
        }
      }

      if (action.tool === 'show_goals') {
        // No validation needed.
      }

      if (action.tool === 'create_goal') {
        const title = this.cleanEntityName(input.title || input.name || input.goal);
        const targetAmount = normalizeMoneyAmount(input.targetAmount || input.amount);
        const currentAmount = normalizeMoneyAmount(input.currentAmount) ?? 0;
        const currency = this.coerceCurrency(input.currency, '', 'RUB') ?? 'RUB';
        const accountName = this.cleanString(input.account);
        const account = accountName ? this.resolveAccount(accounts, accountName) : null;

        if (!title) issues.push({ code: 'missing_goal_title', message: 'Не хватает названия цели.', actionIndex: index, field: 'title' });
        if (!targetAmount) issues.push({ code: 'missing_goal_target', message: 'Не хватает суммы цели.', actionIndex: index, field: 'targetAmount' });
        if (accountName && !account) issues.push({ code: 'goal_account_not_found', message: `Не нашёл счёт для цели: ${accountName}`, actionIndex: index, field: 'account' });

        input.title = title;
        input.targetAmount = targetAmount ?? 0;
        input.currentAmount = currentAmount;
        input.currency = currency;
        input.account = account?.name ?? null;
        input.note = this.cleanEntityName(input.note);
        if (account) resolved.accountId = account.id;
      }

      if (action.tool === 'update_goal' || action.tool === 'delete_goal') {
        const goalName = this.cleanString(input.goal || input.title || input.name);
        const goal = this.findGoalByName(goals, goalName);
        if (!goal) {
          issues.push({
            code: 'goal_not_found',
            message: goalName ? `Не нашёл цель: ${goalName}` : 'Не хватает цели.',
            actionIndex: index,
            field: 'goal',
          });
        } else {
          resolved.goalId = goal.id;
          input.goal = goal.title;
        }

        if (action.tool === 'update_goal') {
          const title = this.cleanEntityName(input.title);
          const targetAmount = normalizeMoneyAmount(input.targetAmount || input.amount);
          const currentAmount = normalizeMoneyAmount(input.currentAmount);
          const status = this.cleanString(input.status);

          if (title) input.title = title; else delete input.title;
          if (targetAmount !== null) input.targetAmount = targetAmount; else delete input.targetAmount;
          if (currentAmount !== null) input.currentAmount = currentAmount; else delete input.currentAmount;
          if (status === 'active' || status === 'completed' || status === 'archived') input.status = status; else delete input.status;
          if (input.note !== null && input.note !== undefined) input.note = this.cleanEntityName(input.note); else delete input.note;
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

      if (action.tool === 'show_taxonomy') {
        // No validation needed.
      }

      if (action.tool === 'update_category' || action.tool === 'delete_category' || action.tool === 'assign_category_to_section') {
        const categoryName = this.cleanEntityName(input.category || input.name);
        const category = this.findByName(categories, categoryName);
        if (!category) {
          issues.push({ code: 'category_not_found', message: categoryName ? `Не нашёл категорию: ${categoryName}` : 'Не хватает категории.', actionIndex: index, field: 'category' });
        } else {
          resolved.categoryId = category.id;
          input.category = category.name;
        }

        if (action.tool === 'update_category') {
          const nextName = this.cleanEntityName(input.name);
          const type = this.cleanString(input.type);
          const sectionName = this.cleanEntityName(input.section);
          if (nextName) input.name = nextName; else delete input.name;
          if (type === 'income' || type === 'expense') input.type = type; else delete input.type;
          if (sectionName) {
            input.section = sectionName;
            const section = this.findByName(sections, sectionName);
            if (section) resolved.sectionId = section.id;
          } else {
            delete input.section;
          }
        }

        if (action.tool === 'assign_category_to_section') {
          const sectionName = this.cleanEntityName(input.section);
          if (!sectionName) issues.push({ code: 'missing_section_name', message: 'Не хватает раздела.', actionIndex: index, field: 'section' });
          input.section = sectionName;
          const section = this.findByName(sections, sectionName);
          if (section) resolved.sectionId = section.id;
        }
      }

      if (action.tool === 'update_section' || action.tool === 'delete_section') {
        const sectionName = this.cleanEntityName(input.section || input.name);
        const section = this.findByName(sections, sectionName);
        if (!section) {
          issues.push({ code: 'section_not_found', message: sectionName ? `Не нашёл раздел: ${sectionName}` : 'Не хватает раздела.', actionIndex: index, field: 'section' });
        } else {
          resolved.sectionId = section.id;
          input.section = section.name;
        }

        if (action.tool === 'update_section') {
          const nextName = this.cleanEntityName(input.name);
          if (!nextName) issues.push({ code: 'missing_section_name', message: 'Не хватает нового названия раздела.', actionIndex: index, field: 'name' });
          input.name = nextName;
        }
      }

      const riskLevel = definition.risk as AIRiskLevel;
      const requiresConfirmation = this.resolveRequiresConfirmation(action.tool, input, resolved, definition.requiresConfirmation, aiSettings);
      actions.push({ ...action, input, resolved, riskLevel, requiresConfirmation });
    }

    actions = this.collapseTransactionSupportActions(actions);

    const maxRisk = this.maxRisk(actions.map((action) => action.riskLevel));

    return aiRiskPolicyService.apply({
      ok: issues.length === 0,
      summary: this.buildSummary(actions),
      actions,
      issues,
      riskLevel: maxRisk,
      requiresConfirmation: actions.some((action) => action.requiresConfirmation),
    });
  }


  private collapseTransactionSupportActions(actions: AIValidatedAction[]): AIValidatedAction[] {
    const transactions = actions.filter((action) => action.tool === 'create_transaction');
    if (transactions.length === 0) return actions;

    const supportIndexes = new Set<number>();

    for (const transaction of transactions) {
      const transactionInput = transaction.input ?? {};
      const transactionCategory = this.key(this.cleanString(transactionInput.category));
      const transactionSection = this.key(this.cleanString(transactionInput.section));

      actions.forEach((action, index) => {
        if (action.tool === 'create_category') {
          const categoryName = this.key(this.cleanString(action.input?.name));
          const categorySection = this.key(this.cleanString(action.input?.section));
          if (categoryName && transactionCategory && categoryName === transactionCategory) {
            if (!transactionInput.section && action.input?.section) transactionInput.section = action.input.section;
            supportIndexes.add(index);
          }
          if (categorySection && transactionSection && categorySection === transactionSection && categoryName === transactionCategory) {
            supportIndexes.add(index);
          }
        }

        if (action.tool === 'create_section') {
          const sectionName = this.key(this.cleanString(action.input?.name));
          if (sectionName && transactionSection && sectionName === transactionSection) {
            supportIndexes.add(index);
          }
        }
      });
    }

    if (supportIndexes.size === 0) return actions;
    return actions.filter((_, index) => !supportIndexes.has(index));
  }

  private resolveRequiresConfirmation(
    tool: string,
    input: Record<string, unknown>,
    resolved: Record<string, unknown>,
    defaultValue: boolean,
    settings: { autoConfirmExpenseLimit?: number | null; autoConfirmIncomeLimit?: number | null; autoConfirmTransferLimit?: number | null; requireConfirmForAccountActions?: boolean | null },
  ) {
    if (tool === 'show_accounts' || tool === 'show_transactions' || tool === 'show_ai_settings' || tool === 'show_goals' || tool === 'show_taxonomy' || tool === 'show_obligations' || tool === 'show_spending_limits') return false;
    if (tool === 'update_onboarding_state' || tool === 'restart_onboarding' || tool === 'create_spending_limit' || tool === 'update_spending_limit') return false;

    if (tool === 'create_account' || tool === 'update_account' || tool === 'update_transaction' || tool === 'delete_account' || tool === 'delete_accounts' || tool === 'set_primary_account' || tool === 'create_category' || tool === 'update_category' || tool === 'delete_category' || tool === 'create_section' || tool === 'update_section' || tool === 'delete_section' || tool === 'assign_category_to_section' || tool === 'create_goal' || tool === 'update_goal' || tool === 'delete_goal') {
      return settings.requireConfirmForAccountActions !== false;
    }

    if (tool === 'update_ai_settings' || tool === 'apply_ai_settings_preset') return true;

    if (tool === 'create_transaction') {
      const amount = Number(resolved.amountInAccountCurrency ?? input.amount ?? 0);
      const kind = input.kind === 'income' ? 'income' : 'expense';
      const fallbackLimit = Number(process.env.AI_AUTO_EXECUTE_TRANSACTION_LIMIT ?? DEFAULT_AUTO_TRANSACTION_LIMIT);
      const limit = kind === 'income'
        ? Number(settings.autoConfirmIncomeLimit ?? fallbackLimit)
        : Number(settings.autoConfirmExpenseLimit ?? fallbackLimit);
      return !(Number.isFinite(amount) && amount > 0 && amount <= limit);
    }

    if (tool === 'transfer_money') {
      const amount = Number(resolved.amountInFromCurrency ?? input.amount ?? 0);
      const limit = Number(settings.autoConfirmTransferLimit ?? 0);
      return !(Number.isFinite(amount) && amount > 0 && amount <= limit);
    }

    return defaultValue;
  }

  private resolveDefaultTransactionAccount(
    accounts: AccountLite[],
    kind: 'income' | 'expense' | null,
    settings: { defaultExpenseAccountId?: string | null; defaultIncomeAccountId?: string | null },
  ) {
    const preferredId = kind === 'income' ? settings.defaultIncomeAccountId : settings.defaultExpenseAccountId;
    if (preferredId) return accounts.find((account) => account.id === preferredId) ?? null;
    return null;
  }

  private optionalMoneyLimit(value: unknown) {
    if (value === null || value === undefined || value === '') return null;
    const amount = normalizeMoneyAmount(value);
    if (amount === null || amount < 0) return null;
    return Math.floor(amount);
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


  private resolveTransaction(transactions: TransactionLite[], input: Record<string, unknown>) {
    const rawId = this.cleanString(input.transactionId || input.id);
    if (rawId) {
      const byId = transactions.find((item) => item.id === rawId);
      if (byId) return byId;
    }

    const target = this.cleanString(input.target).toLowerCase();
    const kind = this.cleanString(input.kind || input.type).toLowerCase();
    if (target === 'last_income') return transactions.find((item) => item.type === 'income') ?? null;
    if (target === 'last_expense') return transactions.find((item) => item.type === 'expense') ?? null;
    if (target === 'last_transfer') return transactions.find((item) => item.type === 'transfer') ?? null;
    if (target === 'last' && (kind === 'income' || kind === 'expense' || kind === 'transfer')) {
      return transactions.find((item) => item.type === kind) ?? null;
    }
    if (target === 'last') return transactions[0] ?? null;

    const rawTransaction = this.cleanString(input.transaction);
    if (rawTransaction) {
      const byId = transactions.find((item) => item.id === rawTransaction);
      if (byId) return byId;

      const resolvedByDescription = this.findTransactionByText(transactions, rawTransaction);
      if (resolvedByDescription) return resolvedByDescription;
    }

    if (kind === 'income' || kind === 'expense' || kind === 'transfer') {
      return transactions.find((item) => item.type === kind) ?? null;
    }

    return null;
  }

  private findTransactionByText(transactions: TransactionLite[], raw: string) {
    const ref = this.key(raw);
    if (!ref) return null;
    return transactions.find((item) => this.key(item.description ?? '') === ref)
      ?? transactions.find((item) => this.key(item.description ?? '').includes(ref) || ref.includes(this.key(item.description ?? '')))
      ?? null;
  }

  private transactionLabel(transaction: TransactionLite) {
    const type = transaction.type === 'income' ? 'доход' : transaction.type === 'expense' ? 'расход' : 'перевод';
    const description = this.cleanString(transaction.description) || transaction.category?.name || 'операция';
    return `последний ${type}: ${description}`;
  }



  private normalizeSpendingLimitTargetType(value: unknown, input: Record<string, unknown>, optional = false) {
    const raw = this.cleanString(value).toLowerCase();
    if (SPENDING_LIMIT_TARGET_TYPES.includes(raw)) return raw as 'account' | 'category' | 'total';
    if (this.cleanString(input.account)) return 'account';
    if (this.cleanEntityName(input.category)) return 'category';
    if (optional) return '';
    return 'total';
  }

  private normalizeSpendingLimitPeriod(value: unknown) {
    const raw = this.cleanString(value).toLowerCase();
    if (SPENDING_LIMIT_PERIODS.includes(raw)) return raw;
    if (['day', 'день', 'дневной', 'daily'].includes(raw)) return 'daily';
    if (['week', 'неделя', 'недельный', 'weekly'].includes(raw)) return 'weekly';
    return 'monthly';
  }

  private optionalPercent(value: unknown, fallback: number) {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Math.round(Number(value));
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100) return fallback;
    return parsed;
  }

  private resolveSpendingLimit(limits: SpendingLimitLite[], rawName: string, targetType: string, accountName: string, categoryName: string) {
    if (rawName) {
      const key = this.key(rawName);
      const byLabel = limits.find((limit) => this.key(this.spendingLimitLabel(limit)) === key)
        ?? limits.find((limit) => this.key(this.spendingLimitLabel(limit)).includes(key) || key.includes(this.key(this.spendingLimitLabel(limit))));
      if (byLabel) return byLabel;
    }

    if (targetType === 'account' || accountName) {
      const accountKey = this.key(accountName || rawName);
      const byAccount = limits.find((limit) => limit.targetType === 'account' && limit.account && (this.key(limit.account.name) === accountKey || this.key(limit.account.name).includes(accountKey) || accountKey.includes(this.key(limit.account.name))));
      if (byAccount) return byAccount;
    }

    if (targetType === 'category' || categoryName) {
      const categoryKey = this.key(categoryName || rawName);
      const byCategory = limits.find((limit) => limit.targetType === 'category' && limit.category && (this.key(limit.category.name) === categoryKey || this.key(limit.category.name).includes(categoryKey) || categoryKey.includes(this.key(limit.category.name))));
      if (byCategory) return byCategory;
    }

    if (targetType === 'total' || this.key(rawName).includes('общ')) {
      const total = limits.find((limit) => limit.targetType === 'total');
      if (total) return total;
    }

    return null;
  }

  private spendingLimitLabel(limit: SpendingLimitLite) {
    if (limit.targetType === 'account') return `лимит счёта ${limit.account?.name ?? ''}`.trim();
    if (limit.targetType === 'category') return `лимит категории ${limit.category?.name ?? ''}`.trim();
    return 'общий лимит расходов';
  }

  private resolveLoan(loans: LoanLite[], rawName: string) {
    const name = this.key(rawName);
    if (!name) return null;
    return loans.find((loan) => this.key(loan.title) === name)
      ?? loans.find((loan) => this.key(loan.title).includes(name) || name.includes(this.key(loan.title)))
      ?? null;
  }

  private normalizeObligationType(value: unknown) {
    const type = this.cleanString(value).toLowerCase();
    return OBLIGATION_TYPES.includes(type) ? type : 'loan';
  }

  private optionalDay(value: unknown) {
    if (value === undefined || value === null || value === '') return null;
    const day = Math.round(Number(value));
    if (!Number.isFinite(day) || day < 1 || day > 31) return null;
    return day;
  }

  private optionalReminderDays(value: unknown, fallback = 1) {
    if (value === undefined || value === null || value === '') return fallback;
    const days = Math.round(Number(value));
    if (!Number.isFinite(days)) return fallback;
    return Math.min(Math.max(days, 0), 30);
  }

  private optionalPositiveInteger(value: unknown) {
    if (value === undefined || value === null || value === '') return null;
    const num = Math.round(Number(value));
    if (!Number.isFinite(num) || num < 1) return null;
    return num;
  }

  private optionalNonNegativeInteger(value: unknown, fallback = 0) {
    if (value === undefined || value === null || value === '') return fallback;
    const num = Math.round(Number(value));
    if (!Number.isFinite(num) || num < 0) return fallback;
    return num;
  }

  private optionalDate(value: unknown) {
    if (value === undefined || value === null || value === '') return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value !== 'string') return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private findGoalByName<T extends { id?: string | null; title: string }>(items: T[], raw: string) {
    const ref = raw.trim().toLowerCase();
    if (!ref) return null;
    return items.find((item) => item.title.toLowerCase() === ref)
      ?? items.find((item) => item.title.toLowerCase().includes(ref) || ref.includes(item.title.toLowerCase()))
      ?? null;
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

    if (action.tool === 'update_transaction') {
      const target = this.cleanString(input.transaction) || this.cleanString(input.target) || 'операцию';
      const changes = [
        input.amount !== undefined ? `сумма ${input.amount}` : '',
        input.description !== undefined ? `описание ${this.cleanString(input.description)}` : '',
        input.account !== undefined ? `счёт ${this.cleanString(input.account)}` : '',
        input.category !== undefined ? `категория ${this.cleanString(input.category)}` : '',
        input.section !== undefined ? `раздел ${this.cleanString(input.section)}` : '',
      ].filter(Boolean).join(', ');
      return `Изменить ${target}${changes ? `: ${changes}` : ''}.`;
    }

    if (action.tool === 'create_account') {
      return `Создать счёт: ${this.cleanString(input.name) || 'без названия'}.`;
    }

    if (action.tool === 'transfer_money') {
      return `Перевод: ${input.amount ?? ''} ${input.currency ?? 'RUB'} со счёта ${input.fromAccount ?? '?'} на ${input.toAccount ?? '?'}.`;
    }

    if (action.tool === 'update_account') {
      return `Изменить счёт: ${this.cleanString(input.account) || this.cleanString(input.name) || 'счёт'}.`;
    }

    if (action.tool === 'delete_account') {
      return `Удалить счёт: ${this.cleanString(input.account) || 'счёт'}.`;
    }

    if (action.tool === 'delete_accounts') {
      return 'Удалить счета.';
    }

    if (action.tool === 'set_primary_account') {
      return `Сделать основным счёт: ${this.cleanString(input.account) || 'счёт'}.`;
    }

    if (action.tool === 'create_goal') {
      return `Создать цель: ${this.cleanString(input.title) || 'цель'} — ${input.targetAmount ?? ''} ${input.currency ?? 'RUB'}.`;
    }

    if (action.tool === 'update_goal') {
      return `Изменить цель: ${this.cleanString(input.goal) || this.cleanString(input.title) || 'цель'}.`;
    }

    if (action.tool === 'delete_goal') {
      return `Удалить цель: ${this.cleanString(input.goal) || 'цель'}.`;
    }

    if (action.tool === 'show_goals') return 'Показать цели.';
    if (action.tool === 'show_taxonomy') return 'Показать категории и разделы.';
    if (action.tool === 'create_category') return `Создать категорию: ${this.cleanString(input.name) || 'категория'}.`;
    if (action.tool === 'update_category') return `Изменить категорию: ${this.cleanString(input.category) || 'категория'}.`;
    if (action.tool === 'delete_category') return `Удалить категорию: ${this.cleanString(input.category) || 'категория'}.`;
    if (action.tool === 'create_section') return `Создать раздел: ${this.cleanString(input.name) || 'раздел'}.`;
    if (action.tool === 'update_section') return `Изменить раздел: ${this.cleanString(input.section) || 'раздел'}.`;
    if (action.tool === 'delete_section') return `Удалить раздел: ${this.cleanString(input.section) || 'раздел'}.`;
    if (action.tool === 'assign_category_to_section') return `Переместить категорию ${this.cleanString(input.category) || 'категория'} в раздел ${this.cleanString(input.section) || 'раздел'}.`;

    if (action.tool === 'show_ai_settings') return 'Показать настройки ИИ.';
    if (action.tool === 'update_ai_settings') return 'Изменить настройки ИИ.';
    if (action.tool === 'apply_ai_settings_preset') return `Применить режим настроек: ${input.preset ?? ''}.`;
    if (action.tool === 'update_onboarding_state') return 'Обновить состояние обучения.';
    if (action.tool === 'restart_onboarding') return 'Запустить обучение заново.';

    return 'Проверь действие перед выполнением.';
  }
}

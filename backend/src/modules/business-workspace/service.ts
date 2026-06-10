import { prisma } from '../../lib/prisma';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/core/errors';
import { subscriptionService } from '../subscription/service';

export type BusinessProfileType = 'self_employed' | 'ip' | 'small_business';

type BusinessWorkspaceInput = {
  profileType?: unknown;
  displayName?: unknown;
  taxMode?: unknown;
  incomeAccountId?: unknown;
  expenseAccountId?: unknown;
  monthlyIncomePlan?: unknown;
  monthlyExpensePlan?: unknown;
  reminderDay?: unknown;
};

const PROFILE_TYPES: BusinessProfileType[] = ['self_employed', 'ip', 'small_business'];
const MONTH_MS = 31 * 24 * 60 * 60 * 1000;

function startOfMonth() {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function normalizeProfileType(value: unknown): BusinessProfileType | undefined {
  if (value === undefined) return undefined;
  if (PROFILE_TYPES.includes(value as BusinessProfileType)) return value as BusinessProfileType;
  throw new BadRequestError('Invalid business profile');
}

function normalizeOptionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') throw new BadRequestError('Invalid text value');
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeMoney(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) throw new BadRequestError('Invalid amount');
  return Math.round(numeric);
}

function normalizeReminderDay(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 28) throw new BadRequestError('Invalid reminder day');
  return numeric;
}

function serializeWorkspace(workspace: NonNullable<Awaited<ReturnType<typeof prisma.businessWorkspace.findUnique>>>) {
  return {
    id: workspace.id,
    profileType: workspace.profileType,
    displayName: workspace.displayName,
    taxMode: workspace.taxMode,
    incomeAccountId: workspace.incomeAccountId,
    expenseAccountId: workspace.expenseAccountId,
    monthlyIncomePlan: workspace.monthlyIncomePlan,
    monthlyExpensePlan: workspace.monthlyExpensePlan,
    reminderDay: workspace.reminderDay,
    createdAt: workspace.createdAt.toISOString(),
    updatedAt: workspace.updatedAt.toISOString(),
  };
}

export class BusinessWorkspaceService {
  private async assertAccess(userId: string) {
    const status = await subscriptionService.getStatus(userId);
    if (!status.access.hasBusiness) {
      throw new ForbiddenError('Business access required');
    }
    return status.access;
  }

  private async ensureWorkspace(userId: string) {
    const existing = await prisma.businessWorkspace.findUnique({ where: { userId } });
    if (existing) return existing;

    return prisma.businessWorkspace.create({
      data: {
        userId,
        profileType: 'self_employed',
      },
    });
  }

  private async assertAccountOwner(userId: string, accountId: string | null | undefined) {
    if (!accountId) return;
    const account = await prisma.account.findFirst({ where: { id: accountId, userId }, select: { id: true } });
    if (!account) throw new NotFoundError('Account not found');
  }

  async getWorkspace(userId: string) {
    const access = await this.assertAccess(userId);
    const workspace = await this.ensureWorkspace(userId);
    const summary = await this.getSummary(userId, workspace);
    const accounts = await prisma.account.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, currency: true, balance: true, type: true },
    });

    return {
      access,
      workspace: serializeWorkspace(workspace),
      summary,
      accounts,
    };
  }

  async updateWorkspace(userId: string, input: BusinessWorkspaceInput) {
    await this.assertAccess(userId);
    const current = await this.ensureWorkspace(userId);

    const profileType = normalizeProfileType(input.profileType);
    const displayName = normalizeOptionalString(input.displayName);
    const taxMode = normalizeOptionalString(input.taxMode);
    const incomeAccountId = normalizeOptionalString(input.incomeAccountId);
    const expenseAccountId = normalizeOptionalString(input.expenseAccountId);
    const monthlyIncomePlan = normalizeMoney(input.monthlyIncomePlan);
    const monthlyExpensePlan = normalizeMoney(input.monthlyExpensePlan);
    const reminderDay = normalizeReminderDay(input.reminderDay);

    await this.assertAccountOwner(userId, incomeAccountId === undefined ? current.incomeAccountId : incomeAccountId);
    await this.assertAccountOwner(userId, expenseAccountId === undefined ? current.expenseAccountId : expenseAccountId);

    const updated = await prisma.businessWorkspace.update({
      where: { userId },
      data: {
        ...(profileType !== undefined ? { profileType } : {}),
        ...(displayName !== undefined ? { displayName } : {}),
        ...(taxMode !== undefined ? { taxMode } : {}),
        ...(incomeAccountId !== undefined ? { incomeAccountId } : {}),
        ...(expenseAccountId !== undefined ? { expenseAccountId } : {}),
        ...(monthlyIncomePlan !== undefined ? { monthlyIncomePlan } : {}),
        ...(monthlyExpensePlan !== undefined ? { monthlyExpensePlan } : {}),
        ...(reminderDay !== undefined ? { reminderDay } : {}),
      },
    });

    const summary = await this.getSummary(userId, updated);
    return { workspace: serializeWorkspace(updated), summary };
  }

  private async getSummary(userId: string, workspace: { monthlyIncomePlan: number; monthlyExpensePlan: number; incomeAccountId: string | null; expenseAccountId: string | null }) {
    const monthStart = startOfMonth();
    const soon = new Date(Date.now() + MONTH_MS);
    const accountIds = [workspace.incomeAccountId, workspace.expenseAccountId].filter((id): id is string => Boolean(id));

    const incomeWhere = {
      userId,
      type: 'income',
      date: { gte: monthStart },
      ...(workspace.incomeAccountId ? { accountId: workspace.incomeAccountId } : {}),
    } as const;

    const expenseWhere = {
      userId,
      type: 'expense',
      date: { gte: monthStart },
      ...(workspace.expenseAccountId ? { accountId: workspace.expenseAccountId } : {}),
    } as const;

    const recentWhere = accountIds.length
      ? { userId, accountId: { in: accountIds } }
      : { userId };

    const [incomeAgg, expenseAgg, activeLoans, upcomingReminders, recentTransactions, recurringPayments, loanPayments] = await Promise.all([
      prisma.transaction.aggregate({ where: incomeWhere, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: expenseWhere, _sum: { amount: true } }),
      prisma.loan.count({ where: { userId, status: 'active' } }),
      prisma.obligationReminder.count({
        where: {
          userId,
          status: 'scheduled',
          remindAt: { gte: new Date(), lte: soon },
        },
      }),
      prisma.transaction.findMany({
        where: recentWhere,
        include: {
          account: { select: { id: true, name: true, currency: true } },
          category: { select: { id: true, name: true } },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 6,
      }),
      prisma.recurringPayment.findMany({
        where: { userId, isActive: true, nextDate: { lte: soon } },
        include: { account: { select: { id: true, name: true, currency: true } } },
        orderBy: { nextDate: 'asc' },
        take: 5,
      }),
      prisma.loan.findMany({
        where: { userId, status: 'active', nextPaymentDate: { not: null, lte: soon } },
        include: { account: { select: { id: true, name: true, currency: true } } },
        orderBy: { nextPaymentDate: 'asc' },
        take: 5,
      }),
    ]);

    const monthIncome = incomeAgg._sum.amount ?? 0;
    const monthExpense = expenseAgg._sum.amount ?? 0;
    const profit = monthIncome - monthExpense;
    const incomePlan = workspace.monthlyIncomePlan;
    const expensePlan = workspace.monthlyExpensePlan;
    const insights: Array<{ type: string; title: string; caption: string }> = [];

    if (!workspace.incomeAccountId && !workspace.expenseAccountId) {
      insights.push({ type: 'setup', title: 'Выбери рабочие счета', caption: 'Так бизнес-раздел будет считать только рабочие деньги, без личных операций.' });
    }
    if (incomePlan > 0 && monthIncome < incomePlan) {
      insights.push({ type: 'income_plan', title: 'До плана по доходам ещё есть запас', caption: `Выполнено ${Math.min(100, Math.round((monthIncome / incomePlan) * 100))}%.` });
    }
    if (expensePlan > 0 && monthExpense > expensePlan) {
      insights.push({ type: 'expense_plan', title: 'Расходы выше плана', caption: 'Проверь регулярные платежи и последние траты.' });
    }
    if (profit >= 0 && monthIncome > 0) {
      insights.push({ type: 'profit', title: 'Месяц в плюсе', caption: 'Фина будет держать фокус на расходах и ближайших платежах.' });
    }

    return {
      monthIncome,
      monthExpense,
      profit,
      incomePlan,
      expensePlan,
      incomeProgress: incomePlan > 0 ? Math.min(100, Math.round((monthIncome / incomePlan) * 100)) : 0,
      expenseProgress: expensePlan > 0 ? Math.min(100, Math.round((monthExpense / expensePlan) * 100)) : 0,
      activeLoans,
      upcomingReminders,
      recentTransactions: recentTransactions.map((item) => ({
        id: item.id,
        title: item.title,
        type: item.type,
        amount: item.amount,
        date: item.date.toISOString(),
        accountName: item.account?.name ?? null,
        categoryName: item.category?.name ?? null,
        currency: item.account?.currency ?? 'RUB',
      })),
      nextPayments: [
        ...recurringPayments.map((item) => ({
          id: item.id,
          type: 'recurring',
          title: item.name,
          amount: item.amount,
          date: item.nextDate.toISOString(),
          accountName: item.account?.name ?? null,
          currency: item.account?.currency ?? 'RUB',
        })),
        ...loanPayments.map((item) => ({
          id: item.id,
          type: 'loan',
          title: item.title,
          amount: item.monthlyPayment,
          date: item.nextPaymentDate?.toISOString() ?? new Date().toISOString(),
          accountName: item.account?.name ?? null,
          currency: item.currency,
        })),
      ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 5),
      insights: insights.slice(0, 3),
    };
  }
}

export const businessWorkspaceService = new BusinessWorkspaceService();

import { prisma } from '../../lib/prisma';
import { BadRequestError } from '../../shared/core/errors';

export type SalaryPeriod = 'monthly' | 'biweekly' | 'manual';

export interface FinancialCycleUpdateInput {
  salaryDay?: number | string | null;
  salaryAmount?: number | string | null;
  salaryCurrency?: string | null;
  salaryAccountId?: string | null;
  salaryPeriod?: SalaryPeriod | string | null;
  remindBeforeDays?: number | string | null;
  autoCreateIncome?: boolean | null;
  autoDistributeGoals?: boolean | null;
}

type FinancialCycleData = Partial<{
  salaryDay: number | null;
  salaryAmount: number;
  salaryCurrency: string;
  salaryAccountId: string | null;
  salaryPeriod: SalaryPeriod;
  remindBeforeDays: number;
  autoCreateIncome: boolean;
  autoDistributeGoals: boolean;
}>;

const ALLOWED_PERIODS = new Set<SalaryPeriod>(['monthly', 'biweekly', 'manual']);
const ALLOWED_CURRENCIES = new Set(['RUB', 'USD', 'EUR', 'VND']);

export class FinancialCycleService {
  async get(userId: string) {
    const settings = await this.ensureSettings(userId);
    return this.serialize(settings);
  }

  async update(userId: string, input: FinancialCycleUpdateInput) {
    await this.ensureUser(userId);
    const data = await this.normalizeUpdate(userId, input);

    const settings = await prisma.financialCycleSettings.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });

    return this.serialize(settings);
  }

  private async ensureSettings(userId: string) {
    await this.ensureUser(userId);

    return prisma.financialCycleSettings.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  private async ensureUser(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new BadRequestError('User not found');
    return user;
  }

  private async normalizeUpdate(userId: string, input: FinancialCycleUpdateInput) {
    const data: FinancialCycleData = {};

    if (input.salaryDay !== undefined) data.salaryDay = this.day(input.salaryDay);
    if (input.salaryAmount !== undefined) data.salaryAmount = this.money(input.salaryAmount);
    if (input.salaryCurrency !== undefined) data.salaryCurrency = this.currency(input.salaryCurrency);
    if (input.salaryAccountId !== undefined) data.salaryAccountId = await this.accountId(userId, input.salaryAccountId);
    if (input.salaryPeriod !== undefined) data.salaryPeriod = this.period(input.salaryPeriod);
    if (input.remindBeforeDays !== undefined) data.remindBeforeDays = this.remindDays(input.remindBeforeDays);
    if (input.autoCreateIncome !== undefined) data.autoCreateIncome = Boolean(input.autoCreateIncome);
    if (input.autoDistributeGoals !== undefined) data.autoDistributeGoals = Boolean(input.autoDistributeGoals);

    if (data.autoCreateIncome === true) {
      throw new BadRequestError('Automatic income creation is not enabled yet');
    }

    return data;
  }

  private day(value: unknown) {
    if (value === null || value === '') return null;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 31) {
      throw new BadRequestError('Salary day must be between 1 and 31');
    }
    return parsed;
  }

  private money(value: unknown) {
    if (value === null || value === '') return 0;
    const parsed = typeof value === 'number' ? value : Number(String(value).replace(/\s+/g, '').replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) throw new BadRequestError('Salary amount must be positive');
    return Math.floor(parsed);
  }

  private currency(value: unknown) {
    const currency = typeof value === 'string' ? value.trim().toUpperCase() : '';
    return ALLOWED_CURRENCIES.has(currency) ? currency : 'RUB';
  }

  private period(value: unknown): SalaryPeriod {
    const period = typeof value === 'string' ? value.trim().toLowerCase() : 'monthly';
    if (!ALLOWED_PERIODS.has(period as SalaryPeriod)) throw new BadRequestError('Invalid salary period');
    return period as SalaryPeriod;
  }

  private remindDays(value: unknown) {
    if (value === null || value === '') return 0;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 14) {
      throw new BadRequestError('Reminder days must be between 0 and 14');
    }
    return parsed;
  }

  private async accountId(userId: string, value: unknown) {
    const accountId = typeof value === 'string' ? value.trim() : '';
    if (!accountId) return null;

    const account = await prisma.account.findFirst({
      where: { id: accountId, userId },
      select: { id: true },
    });

    if (!account) throw new BadRequestError('Salary account not found');
    return account.id;
  }

  private serialize(settings: {
    id: string;
    userId: string;
    salaryDay: number | null;
    salaryAmount: number;
    salaryCurrency: string;
    salaryAccountId: string | null;
    salaryPeriod: string;
    remindBeforeDays: number;
    autoCreateIncome: boolean;
    autoDistributeGoals: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: settings.id,
      userId: settings.userId,
      salaryDay: settings.salaryDay,
      salaryAmount: settings.salaryAmount,
      salaryCurrency: settings.salaryCurrency,
      salaryAccountId: settings.salaryAccountId,
      salaryPeriod: settings.salaryPeriod,
      remindBeforeDays: settings.remindBeforeDays,
      autoCreateIncome: settings.autoCreateIncome,
      autoDistributeGoals: settings.autoDistributeGoals,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }
}

export const financialCycleService = new FinancialCycleService();

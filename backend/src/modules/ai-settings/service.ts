import { prisma } from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../shared/core/errors';
import type { AISettingsPreset, AISettingsUpdateInput, CompanionTone, OnboardingUpdateInput } from './types';

const PRESETS: Record<AISettingsPreset, {
  autoConfirmExpenseLimit: number;
  autoConfirmIncomeLimit: number;
  autoConfirmTransferLimit: number;
  requireConfirmForAccountActions: boolean;
  companionTone: CompanionTone;
}> = {
  strict: {
    autoConfirmExpenseLimit: 0,
    autoConfirmIncomeLimit: 0,
    autoConfirmTransferLimit: 0,
    requireConfirmForAccountActions: true,
    companionTone: 'calm',
  },
  balanced: {
    autoConfirmExpenseLimit: 5000,
    autoConfirmIncomeLimit: 200000,
    autoConfirmTransferLimit: 0,
    requireConfirmForAccountActions: true,
    companionTone: 'friendly',
  },
  simple: {
    autoConfirmExpenseLimit: 5000,
    autoConfirmIncomeLimit: 250000,
    autoConfirmTransferLimit: 0,
    requireConfirmForAccountActions: true,
    companionTone: 'coach',
  },
  fast: {
    autoConfirmExpenseLimit: 1000000,
    autoConfirmIncomeLimit: 5000000,
    autoConfirmTransferLimit: 0,
    requireConfirmForAccountActions: false,
    companionTone: 'friendly',
  },
};

const ONBOARDING_STEPS = [
  'create_first_account',
  'add_initial_money',
  'record_first_expense',
  'review_dashboard',
  'set_default_account',
] as const;

export class AISettingsService {
  async getSettings(userId: string) {
    const user = await this.ensureUser(userId);
    await this.ensureSettings(userId);
    await this.ensureOnboarding(userId);

    const [settings, onboarding, accounts] = await Promise.all([
      prisma.userAISettings.findUnique({ where: { userId } }),
      prisma.onboardingState.findUnique({ where: { userId } }),
      prisma.account.findMany({
        where: { userId },
        select: { id: true, name: true, type: true, currency: true, balance: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return {
      userId: user.id,
      settings,
      onboarding: {
        ...onboarding,
        meta: this.parseJson(onboarding?.meta ?? null),
        steps: ONBOARDING_STEPS,
      },
      recommendedPresets: this.getRecommendedPresets(),
      accounts,
    };
  }

  async updateSettings(userId: string, input: AISettingsUpdateInput) {
    await this.ensureUser(userId);
    await this.ensureSettings(userId);

    const data = await this.normalizeSettingsInput(userId, input);

    const settings = await prisma.userAISettings.update({
      where: { userId },
      data,
    });

    return this.getSettings(userId).then((snapshot) => ({ ...snapshot, settings }));
  }

  async applyPreset(userId: string, preset: AISettingsPreset) {
    await this.ensureUser(userId);
    await this.ensureSettings(userId);

    const config = PRESETS[preset];
    if (!config) throw new BadRequestError('Unknown AI settings preset');

    const accounts = await prisma.account.findMany({
      where: { userId },
      select: { id: true, type: true },
      orderBy: { createdAt: 'asc' },
    });

    const defaultExpenseAccountId = accounts.find((account) => account.type === 'cash')?.id
      ?? accounts.find((account) => account.type === 'card')?.id
      ?? accounts[0]?.id
      ?? null;

    const defaultIncomeAccountId = accounts.find((account) => account.type === 'card')?.id
      ?? accounts[0]?.id
      ?? null;

    await prisma.userAISettings.update({
      where: { userId },
      data: {
        preset,
        ...config,
        ...(preset !== 'strict' ? { defaultExpenseAccountId, defaultIncomeAccountId } : {}),
      },
    });

    return this.getSettings(userId);
  }

  async getOnboarding(userId: string) {
    await this.ensureUser(userId);
    await this.ensureOnboarding(userId);

    const state = await prisma.onboardingState.findUnique({ where: { userId } });

    return {
      ...state,
      meta: this.parseJson(state?.meta ?? null),
      steps: ONBOARDING_STEPS,
    };
  }

  async updateOnboarding(userId: string, input: OnboardingUpdateInput) {
    await this.ensureUser(userId);
    await this.ensureOnboarding(userId);

    const status = this.normalizeOnboardingStatus(input.status);
    const skipped = typeof input.skipped === 'boolean' ? input.skipped : undefined;
    const currentStep = input.currentStep === undefined ? undefined : this.normalizeStep(input.currentStep);
    const completedAt = status === 'completed' || skipped === true ? new Date() : undefined;

    const state = await prisma.onboardingState.update({
      where: { userId },
      data: {
        ...(status ? { status } : {}),
        ...(currentStep !== undefined ? { currentStep } : {}),
        ...(skipped !== undefined ? { skipped } : {}),
        ...(completedAt ? { completedAt } : {}),
        ...(input.meta !== undefined ? { meta: this.stringifyJson(input.meta) } : {}),
      },
    });

    return {
      ...state,
      meta: this.parseJson(state.meta),
      steps: ONBOARDING_STEPS,
    };
  }

  async restartOnboarding(userId: string) {
    await this.ensureUser(userId);

    const state = await prisma.onboardingState.upsert({
      where: { userId },
      create: {
        userId,
        status: 'active',
        currentStep: 'create_first_account',
        skipped: false,
        meta: null,
      },
      update: {
        status: 'active',
        currentStep: 'create_first_account',
        skipped: false,
        completedAt: null,
        meta: null,
      },
    });

    return {
      ...state,
      meta: this.parseJson(state.meta),
      steps: ONBOARDING_STEPS,
    };
  }

  getRecommendedPresets() {
    return [
      {
        key: 'strict',
        title: 'Контроль',
        description: 'Максимум подтверждений. Хорошо для старта и тестов.',
      },
      {
        key: 'balanced',
        title: 'Баланс',
        description: 'Мелкие расходы до 500 ₽ без подтверждения, опасные действия всегда через confirm.',
      },
      {
        key: 'simple',
        title: 'Простой режим',
        description: 'Меньше вопросов для повседневного учёта. Подходит тем, кто не хочет настраивать вручную.',
      },
      {
        key: 'fast',
        title: 'Минимум подтверждений',
        description: 'Обычные команды выполняются сразу. Проверка остаётся для опасных действий и неясных запросов.',
      },
    ];
  }

  private async ensureUser(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundError('User not found');
    return user;
  }

  private async ensureSettings(userId: string) {
    await prisma.userAISettings.upsert({
      where: { userId },
      create: { userId, autoConfirmExpenseLimit: 5000, autoConfirmIncomeLimit: 200000 },
      update: {},
    });
  }

  private async ensureOnboarding(userId: string) {
    await prisma.onboardingState.upsert({
      where: { userId },
      create: {
        userId,
        status: 'not_started',
        currentStep: 'create_first_account',
      },
      update: {},
    });
  }

  private async normalizeSettingsInput(userId: string, input: AISettingsUpdateInput) {
    const data: Record<string, unknown> = {};

    if (input.preset !== undefined) {
      if (!this.isPreset(input.preset)) throw new BadRequestError('Invalid preset');
      data.preset = input.preset;
    }

    if (input.defaultExpenseAccountId !== undefined) {
      data.defaultExpenseAccountId = await this.normalizeAccountId(userId, input.defaultExpenseAccountId);
    }

    if (input.defaultIncomeAccountId !== undefined) {
      data.defaultIncomeAccountId = await this.normalizeAccountId(userId, input.defaultIncomeAccountId);
    }

    if (input.autoConfirmExpenseLimit !== undefined) {
      data.autoConfirmExpenseLimit = this.normalizeLimit(input.autoConfirmExpenseLimit, 0, 1000000);
    }

    if (input.autoConfirmIncomeLimit !== undefined) {
      data.autoConfirmIncomeLimit = this.normalizeLimit(input.autoConfirmIncomeLimit, 0, 5000000);
    }

    if (input.autoConfirmTransferLimit !== undefined) {
      data.autoConfirmTransferLimit = this.normalizeLimit(input.autoConfirmTransferLimit, 0, 1000000);
    }

    if (input.requireConfirmForAccountActions !== undefined) {
      data.requireConfirmForAccountActions = Boolean(input.requireConfirmForAccountActions);
    }

    if (input.companionTone !== undefined) {
      if (!this.isCompanionTone(input.companionTone)) throw new BadRequestError('Invalid companion tone');
      data.companionTone = input.companionTone;
    }

    return data;
  }

  private async normalizeAccountId(userId: string, value: string | null | undefined) {
    if (!value) return null;

    const account = await prisma.account.findFirst({
      where: { id: value, userId },
      select: { id: true },
    });

    if (!account) throw new BadRequestError('Account does not belong to user');
    return account.id;
  }

  private normalizeLimit(value: unknown, min: number, max: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      throw new BadRequestError(`Limit must be between ${min} and ${max}`);
    }

    return Math.floor(parsed);
  }

  private normalizeOnboardingStatus(value: unknown) {
    if (value === undefined) return undefined;
    if (value === 'not_started' || value === 'active' || value === 'completed') return value;
    throw new BadRequestError('Invalid onboarding status');
  }

  private normalizeStep(value: string | null | undefined) {
    if (value === null || value === '') return null;
    if (typeof value !== 'string') throw new BadRequestError('Invalid onboarding step');

    const step = value.trim();
    if (!ONBOARDING_STEPS.includes(step as typeof ONBOARDING_STEPS[number])) {
      throw new BadRequestError('Unknown onboarding step');
    }

    return step;
  }

  private isPreset(value: unknown): value is AISettingsPreset {
    return value === 'strict' || value === 'balanced' || value === 'simple' || value === 'fast';
  }

  private isCompanionTone(value: unknown): value is CompanionTone {
    return value === 'calm' || value === 'friendly' || value === 'strict' || value === 'coach';
  }

  private stringifyJson(value: unknown) {
    try {
      return JSON.stringify(value);
    } catch {
      return JSON.stringify({ raw: String(value) });
    }
  }

  private parseJson(value: string | null) {
    if (!value) return null;

    try {
      return JSON.parse(value) as unknown;
    } catch {
      return { raw: value };
    }
  }
}

export const aiSettingsService = new AISettingsService();

import { prisma } from '../../lib/prisma';

export type DataResetMode = 'finance' | 'full';

type ResetTarget = {
  userId?: string;
  allUsers?: boolean;
};

export type DataResetResult = {
  mode: DataResetMode;
  scope: 'single' | 'all';
  userId: string | null;
  deleted: Record<string, number>;
  updated: Record<string, number>;
};

function normalizeMode(value: unknown): DataResetMode {
  return value === 'full' ? 'full' : 'finance';
}

function whereUser(target: ResetTarget) {
  if (target.allUsers) return {};
  if (!target.userId) throw new Error('userId is required');
  return { userId: target.userId };
}

function whereUserId(target: ResetTarget) {
  if (target.allUsers) return {};
  if (!target.userId) throw new Error('userId is required');
  return { id: target.userId };
}

export class DataResetService {
  parseMode(value: unknown): DataResetMode {
    return normalizeMode(value);
  }

  async reset(target: ResetTarget, rawMode: unknown): Promise<DataResetResult> {
    const mode = normalizeMode(rawMode);
    const userWhere = whereUser(target);
    const userIdWhere = whereUserId(target);
    const deleted: Record<string, number> = {};
    const updated: Record<string, number> = {};

    await prisma.$transaction(async (tx) => {
      deleted.aiPendingActions = (await tx.aIPendingAction.deleteMany({ where: userWhere })).count;
      deleted.aiAuditLogs = (await tx.aIAuditLog.deleteMany({ where: userWhere })).count;
      deleted.aiMessages = (await tx.aIMessage.deleteMany({ where: userWhere })).count;
      deleted.aiTrainingExamples = (await tx.aITrainingExample.deleteMany({ where: userWhere })).count;
      deleted.aiSessionState = (await tx.aISessionState.deleteMany({ where: userWhere })).count;
      deleted.aiIdempotencyRecords = (await tx.aIIdempotencyRecord.deleteMany({ where: userWhere })).count;
      deleted.aiOperationEvents = (await tx.aIOperationEvent.deleteMany({ where: userWhere })).count;

      deleted.notificationDeliveries = (await tx.notificationDelivery.deleteMany({ where: userWhere })).count;
      deleted.notifications = (await tx.notification.deleteMany({ where: userWhere })).count;
      deleted.obligationReminders = (await tx.obligationReminder.deleteMany({ where: userWhere })).count;
      deleted.loanPayments = (await tx.loanPayment.deleteMany({ where: userWhere })).count;
      deleted.loans = (await tx.loan.deleteMany({ where: userWhere })).count;
      deleted.recurringPayments = (await tx.recurringPayment.deleteMany({ where: userWhere })).count;
      deleted.spendingLimits = (await tx.spendingLimit.deleteMany({ where: userWhere })).count;
      deleted.budgets = (await tx.budget.deleteMany({ where: userWhere })).count;
      deleted.transactions = (await tx.transaction.deleteMany({ where: userWhere })).count;
      deleted.goals = (await tx.goal.deleteMany({ where: userWhere })).count;
      deleted.categories = (await tx.category.deleteMany({ where: userWhere })).count;
      deleted.sections = (await tx.section.deleteMany({ where: userWhere })).count;
      deleted.accounts = (await tx.account.deleteMany({ where: userWhere })).count;

      if (mode === 'full') {
        deleted.notificationSettings = (await tx.notificationSettings.deleteMany({ where: userWhere })).count;
        deleted.userAchievements = (await tx.userAchievement.deleteMany({ where: userWhere })).count;
        deleted.userActivities = (await tx.userActivity.deleteMany({ where: userWhere })).count;
        deleted.progressionProfiles = (await tx.progressionProfile.deleteMany({ where: userWhere })).count;
        deleted.companionEvents = (await tx.aICompanionEvent.deleteMany({ where: userWhere })).count;
        deleted.aiSettings = (await tx.userAISettings.deleteMany({ where: userWhere })).count;
        deleted.onboardingState = (await tx.onboardingState.deleteMany({ where: userWhere })).count;
        deleted.premiumCapabilities = (await tx.aIPremiumCapability.deleteMany({ where: userWhere })).count;
        deleted.subscriptions = (await tx.subscription.deleteMany({ where: userWhere })).count;

        updated.users = (await tx.user.updateMany({
          where: userIdWhere,
          data: {
            balance: 0,
            xp: 0,
            level: 1,
            streakDays: 0,
            referralBalance: 0,
            voiceLimit: 5,
            tier: 'FREE',
            lastActiveAt: null,
          },
        })).count;
      }
    });

    return {
      mode,
      scope: target.allUsers ? 'all' : 'single',
      userId: target.userId ?? null,
      deleted,
      updated,
    };
  }
}

export const dataResetService = new DataResetService();
